/**
 * SCE D1 Import Script
 *
 * Reads exported JSON files (chunks.json, vectors.json, symbols.json, meta.json)
 * and imports them into a Cloudflare D1 database via the wrangler CLI.
 *
 * Uses --file instead of --command to avoid Windows command line length limits.
 *
 * Usage:
 *   npx tsx packages/web/import.ts ./sce-export sce-db
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

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
  partIndex?: number;
  totalParts?: number;
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

/** Chunk batch size — 10 to stay under SQLite statement size limit (some chunks are ~19KB). */
const CHUNK_BATCH_SIZE = 10; // Average chunk ~6KB, 10 per batch = ~60KB < 100KB limit

/** Vectors are large (2048 floats as JSON ~39KB each); D1 max statement is 100KB, so max 2 per batch. */
const VECTOR_BATCH_SIZE = 2;

// --- Helpers ---

function escapeString(s: string): string {
  // Strip null bytes (D1/SQLite treats them as string terminators)
  return s.replace(/\0/g, '').replace(/'/g, "''");
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
  /** Optional: only import vectors and embedding config (skip chunks/symbols). */
  vectorsOnly?: boolean;
  /** Optional: append mode - skip clearing, just insert new data. */
  append?: boolean;
}

export async function importToD1(options: ImportOptions): Promise<void> {
  const { dbCommand, exportDir, skipClear = false, vectorsOnly = false, append = false } = options;

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

  if (append) {
    console.log("Append mode - skipping clear.");
  } else if (!skipClear && !vectorsOnly) {
    console.log("Clearing existing data...");
    await dbCommand("DELETE FROM symbols");
    await dbCommand("DELETE FROM vectors");
    await dbCommand("DELETE FROM chunks");
    await dbCommand("DELETE FROM embedding_config");
  } else if (!skipClear && vectorsOnly) {
    console.log("Clearing vectors only...");
    await dbCommand("DELETE FROM vectors");
    await dbCommand("DELETE FROM embedding_config");
  }

  // --- Import chunks in batches ---

  if (!vectorsOnly) {
    console.log(`Importing chunks (${chunks.length} total)...`);
    const chunkBatches = chunkArray(chunks, CHUNK_BATCH_SIZE);
    for (let i = 0; i < chunkBatches.length; i++) {
      const batch = chunkBatches[i];
      const values = batch
        .map(
          (c) =>
            `('${c.id}', '${escapeString(c.repositoryId)}', '${escapeString(c.relativePath)}', ${nullableString(c.language)}, ${nullableString(c.headingPath)}, ${c.startLine}, ${c.endLine}, '${escapeString(c.text)}', ${c.partIndex ?? 'NULL'}, ${c.totalParts ?? 'NULL'})`
        )
        .join(",\n       ");
      await dbCommand(
        `INSERT OR REPLACE INTO chunks (id, repository_id, relative_path, language, heading_path, start_line, end_line, text, part_index, total_parts) VALUES ${values}`
      );
      const done = Math.min((i + 1) * CHUNK_BATCH_SIZE, chunks.length);
      process.stdout.write(`\r  Chunks: ${done}/${chunks.length}`);
    }
    process.stdout.write("\n");
  } else {
    console.log("Skipping chunks (vectors-only mode).");
  }

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

  // --- Import symbols in batches ---

  if (symbols.length > 0 && !vectorsOnly) {
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
  } else if (vectorsOnly) {
    console.log("Skipping symbols (vectors-only mode).");
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
  const vectorsOnly = args.includes("--vectors-only");
  const append = args.includes("--append");
  const positional = args.filter((a) => !a.startsWith("--"));
  const exportDir = resolve(positional[0] || "./sce-export");
  const databaseName = positional[1] || "sce-db";

  console.log(`Import from: ${exportDir}`);
  console.log(`Target D1 database: ${databaseName}`);
  if (vectorsOnly) console.log("Mode: vectors-only (skip chunks/symbols)");
  if (append) console.log("Mode: append (skip clear)");
  console.log();

  const tmpDir = join(process.cwd(), ".sce-import-tmp");
  mkdirSync(tmpDir, { recursive: true });
  let fileCounter = 0;

  async function dbCommand(sql: string, retries = 3): Promise<void> {
    // Write SQL to a temp file to avoid Windows command line length limit
    const tmpFile = join(tmpDir, `import-${String(fileCounter++).padStart(6, "0")}.sql`);
    writeFileSync(tmpFile, sql, "utf-8");
    try {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          execSync(
            `npx wrangler d1 execute ${databaseName} --remote --file="${tmpFile}"`,
            { stdio: "pipe" }
          );
          return; // success
        } catch (err) {
          if (attempt < retries) {
            const delay = attempt * 2000; // 2s, 4s, 6s
            console.log(`\n  Retry ${attempt}/${retries} after ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            throw err;
          }
        }
      }
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  try {
    await importToD1({ dbCommand, exportDir, vectorsOnly, append });
  } finally {
    // Clean up temp dir
    try {
      const files = readdirSync(tmpDir);
      for (const f of files) unlinkSync(join(tmpDir, f));
      rmdirSync(tmpDir);
    } catch {
      // ignore cleanup errors
    }
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
