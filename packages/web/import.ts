/**
 * SCE D1 Import Script
 *
 * Reads exported JSON files (chunks.json, vectors.json, symbols.json, meta.json)
 * and imports them into a Cloudflare D1 database via the wrangler CLI.
 *
 * Usage (standalone with wrangler):
 *   npx wrangler d1 execute sce-db --remote --command="..."
 *
 * Usage (programmatic):
 *   import { importToD1 } from './import.js';
 *   await importToD1({ dbCommand: myDbRunner, exportDir: './sce-export' });
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- Types (mirrors packages/core/src/export.ts) ---

interface ExportedChunk {
  id: string;
  repositoryId: string;
  relativePath: string;
  language: string | null;
  headingPath: string | null;
  startLine: number;
  endLine: number;
  text: string;
}

interface ExportedVector {
  chunkId: string;
  embedding: number[];
}

interface ExportedSymbol {
  id: number;
  chunkId: string;
  name: string;
  qualifiedName: string | null;
  symbolKind: string | null;
  relativePath: string;
  repositoryId: string;
}

interface ExportMeta {
  exportedAt: string;
  chunkCount: number;
  vectorCount: number;
  symbolCount: number;
  embeddingModel: string;
  embeddingDimensions: number;
}

// --- Constants ---

/** D1 batch limit is 100 statements; we stay well under with 50 rows per INSERT. */
const CHUNK_BATCH_SIZE = 50;

/** Vectors are large (2048 floats as JSON); keep batches small. */
const VECTOR_BATCH_SIZE = 10;

// --- Helpers ---

function escapeString(s: string): string {
  // Double single-quotes for SQL string literals
  return s.replace(/'/g, "''");
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function nullableString(val: string | null): string {
  if (val === null || val === undefined) return "NULL";
  return `'${escapeString(String(val))}'`;
}

// --- Main import function ---

export interface ImportOptions {
  /** Execute a raw SQL command against D1. */
  dbCommand: (sql: string) => Promise<void>;
  /** Directory containing the exported JSON files. */
  exportDir: string;
  /** Optional: skip clearing existing data (default: false). */
  skipClear?: boolean;
}

export async function importToD1(options: ImportOptions): Promise<void> {
  const { dbCommand, exportDir, skipClear = false } = options;

  // --- Read export files ---

  const chunks: ExportedChunk[] = JSON.parse(
    readFileSync(resolve(exportDir, "chunks.json"), "utf-8")
  );
  const vectors: ExportedVector[] = JSON.parse(
    readFileSync(resolve(exportDir, "vectors.json"), "utf-8")
  );
  const symbols: ExportedSymbol[] = JSON.parse(
    readFileSync(resolve(exportDir, "symbols.json"), "utf-8")
  );
  const meta: ExportMeta = JSON.parse(
    readFileSync(resolve(exportDir, "meta.json"), "utf-8")
  );

  console.log(
    `Importing: ${chunks.length} chunks, ${vectors.length} vectors, ${symbols.length} symbols`
  );
  console.log(
    `Embedding model: ${meta.embeddingModel} (${meta.embeddingDimensions}d)`
  );

  // --- Clear existing data (idempotent re-import) ---

  if (!skipClear) {
    console.log("Clearing existing data...");
    await dbCommand("DELETE FROM symbols");
    await dbCommand("DELETE FROM vectors");
    await dbCommand("DELETE FROM chunks");
    await dbCommand("DELETE FROM embedding_config");
  }

  // --- Import chunks in batches ---

  console.log(`Importing chunks (${chunks.length} total)...`);
  const chunkBatches = chunkArray(chunks, CHUNK_BATCH_SIZE);
  for (let i = 0; i < chunkBatches.length; i++) {
    const batch = chunkBatches[i];
    const values = batch
      .map(
        (c) =>
          `('${c.id}', '${escapeString(c.repositoryId)}', '${escapeString(c.relativePath)}', ${nullableString(c.language)}, ${nullableString(c.headingPath)}, ${c.startLine}, ${c.endLine}, '${escapeString(c.text)}')`
      )
      .join(",\n       ");
    await dbCommand(
      `INSERT OR REPLACE INTO chunks (id, repository_id, relative_path, language, heading_path, start_line, end_line, text) VALUES ${values}`
    );
    const done = Math.min((i + 1) * CHUNK_BATCH_SIZE, chunks.length);
    process.stdout.write(`\r  Chunks: ${done}/${chunks.length}`);
  }
  process.stdout.write("\n");

  // --- Import vectors in batches ---

  console.log(`Importing vectors (${vectors.length} total)...`);
  const vectorBatches = chunkArray(vectors, VECTOR_BATCH_SIZE);
  for (let i = 0; i < vectorBatches.length; i++) {
    const batch = vectorBatches[i];
    const values = batch
      .map((v) => {
        const embeddingJson = JSON.stringify(v.embedding);
        return `('${v.chunkId}', '${escapeString(embeddingJson)}')`;
      })
      .join(", ");
    await dbCommand(
      `INSERT OR REPLACE INTO vectors (chunk_id, embedding) VALUES ${values}`
    );
    const done = Math.min((i + 1) * VECTOR_BATCH_SIZE, vectors.length);
    process.stdout.write(`\r  Vectors: ${done}/${vectors.length}`);
  }
  process.stdout.write("\n");

  // --- Import symbols in batches (symbols can be numerous) ---

  if (symbols.length > 0) {
    console.log(`Importing symbols (${symbols.length} total)...`);
    const symbolBatches = chunkArray(symbols, CHUNK_BATCH_SIZE);
    for (let i = 0; i < symbolBatches.length; i++) {
      const batch = symbolBatches[i];
      const values = batch
        .map(
          (s) =>
            `(${s.id}, '${s.chunkId}', '${escapeString(s.name)}', ${nullableString(s.qualifiedName)}, ${nullableString(s.symbolKind)}, '${escapeString(s.relativePath)}', '${escapeString(s.repositoryId)}')`
        )
        .join(", ");
      await dbCommand(
        `INSERT OR REPLACE INTO symbols (id, chunk_id, name, qualified_name, symbol_kind, relative_path, repository_id) VALUES ${values}`
      );
      const done = Math.min((i + 1) * CHUNK_BATCH_SIZE, symbols.length);
      process.stdout.write(`\r  Symbols: ${done}/${symbols.length}`);
    }
    process.stdout.write("\n");
  }

  // --- Store embedding config ---

  console.log("Storing embedding config...");
  await dbCommand(
    `INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('model', '${escapeString(meta.embeddingModel)}')`
  );
  await dbCommand(
    `INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('dimensions', '${String(meta.embeddingDimensions)}')`
  );
  await dbCommand(
    `INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('exported_at', '${escapeString(meta.exportedAt)}')`
  );

  console.log("Import complete.");
}

// --- CLI entry point ---

async function main() {
  const args = process.argv.slice(2);
  const exportDir = resolve(args[0] || "./sce-export");
  const databaseName = args[1] || "sce-db";

  console.log(`Import from: ${exportDir}`);
  console.log(`Target D1 database: ${databaseName}`);
  console.log();

  // Use dynamic import for child_process to avoid issues in non-Node environments
  const { execSync } = await import("node:child_process");

  async function dbCommand(sql: string): Promise<void> {
    execSync(
      `npx wrangler d1 execute ${databaseName} --remote --command="${sql.replace(/"/g, '\\"')}"`,
      { stdio: "pipe" }
    );
  }

  await importToD1({ dbCommand, exportDir });
}

// Run if executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("import.ts");
if (isMainModule) {
  main().catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
}
