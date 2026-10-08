#!/usr/bin/env node
/**
 * Vector Backfill Script
 *
 * Reads existing chunks from a topic's local metadata SQLite database,
 * generates embedding vectors via OpenRouter, and writes them back.
 *
 * Handles splitting of oversized chunks (>7500 chars) per the same
 * logic used by the Indexer.
 *
 * Usage:
 *   export OPENROUTER_API_KEY=sk-...
 *   node scripts/backfill-vectors.mjs knowledge/unity-profiler-deep
 *   node scripts/backfill-vectors.mjs --batch knowledge/*-deep
 */

import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2:free";
const EMBEDDING_DIMS = 2048;
const API_BASE = "https://openrouter.ai/api/v1";
const MAX_CHARS_PER_PART = 7500;

function getApiKey() {
  return process.env.OPENROUTER_API_KEY || "";
}

/**
 * Split a chunk into embedding-safe parts if its text exceeds MAX_CHARS_PER_PART.
 * Mirrors the logic in packages/indexing/src/Indexer.ts.
 */
function splitChunkForEmbedding(chunk) {
  if (chunk.text.length <= MAX_CHARS_PER_PART) return [chunk];

  const parts = [];
  const text = chunk.text;
  let partIndex = 0;
  let offset = 0;

  while (offset < text.length) {
    const isLast = offset + MAX_CHARS_PER_PART >= text.length;
    const end = isLast ? text.length : offset + MAX_CHARS_PER_PART;
    const partText = text.substring(offset, end);
    const totalParts = Math.ceil(text.length / MAX_CHARS_PER_PART);

    const suffix = isLast
      ? `\n\n---\n📄 *Part ${partIndex + 1} of ${totalParts} (end)*`
      : `\n\n---\n→ *Continues in Part ${partIndex + 2} of ${totalParts}*`;

    const partId = createHash("sha256")
      .update(`${chunk.id}#part${partIndex}`)
      .digest("hex");

    parts.push({
      ...chunk,
      id: partId,
      text: partText + suffix,
      partIndex,
      totalParts,
    });
    partIndex++;
    offset = end;
  }
  return parts;
}

async function embedTexts(texts) {
  const key = getApiKey();
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  if (texts.length === 0) return [];

  const response = await fetch(`${API_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error(
      `Unexpected API response shape: ${JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data.data.map((item) => item.embedding);
}

async function backfillVectors(topicDir) {
  const resolved = resolve(topicDir);
  const metaPath = join(resolved, ".sce", "metadata.sqlite");

  const { default: Database } = await import("better-sqlite3");
  const db = new Database(metaPath);

  const chunks = db
    .prepare(
      "SELECT c.id, c.text, c.repository_id, c.relative_path, c.start_line, c.end_line FROM chunks c ORDER BY c.repository_id, c.relative_path, c.start_line"
    )
    .all();

  const topicName = topicDir.replace(/.*\//, "");
  console.log(`${topicName}: ${chunks.length} chunks found`);

  const vectorCount = db
    .prepare("SELECT COUNT(*) as cnt FROM vectors")
    .get().cnt;
  if (vectorCount > 0) {
    console.log(`  Already has ${vectorCount} vectors — skipping`);
    db.close();
    return;
  }

  // Split oversized chunks (same logic as Indexer)
  const splitChunks = chunks.flatMap(splitChunkForEmbedding);
  if (splitChunks.length !== chunks.length) {
    console.log(
      `  Split ${chunks.length} raw chunks into ${splitChunks.length} embedding-safe parts`
    );
    // Save split parts to chunks table (replacing originals)
    const delChunks = db.prepare("DELETE FROM chunks WHERE id = ?");
    const delFts = db.prepare("DELETE FROM chunks_fts WHERE rowid IN (SELECT rowid FROM chunks WHERE id = ?)");
    const insChunk = db.prepare(
      `INSERT OR REPLACE INTO chunks (id, repository_id, relative_path, language, heading_path, start_line, end_line, text, part_index, total_parts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateChunks = db.transaction((originals, parts) => {
      for (const orig of originals) {
        delFts.run(orig.id);
        delChunks.run(orig.id);
      }
      for (const p of parts) {
        insChunk.run(p.id, p.repository_id, p.relative_path, null, null, p.start_line || 0, p.end_line || 0, p.text, p.partIndex, p.totalParts);
      }
    });
    updateChunks(chunks, splitChunks);
  }

  const BATCH_SIZE = 5;
  let totalVectors = 0;

  for (let i = 0; i < splitChunks.length; i += BATCH_SIZE) {
    const batch = splitChunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    process.stdout.write(
      `\r  Embedding ${i + 1}-${Math.min(i + BATCH_SIZE, splitChunks.length)}/${splitChunks.length}...`
    );

    try {
      const embeddings = await embedTexts(texts);

      const insert = db.prepare(
        `INSERT OR REPLACE INTO vectors (repository_id, chunk_id, relative_path, model, dimensions, vector, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      const insertMany = db.transaction((rows) => {
        for (const row of rows) {
          insert.run(
            row.repositoryId,
            row.chunkId,
            row.relativePath,
            EMBEDDING_MODEL,
            EMBEDDING_DIMS,
            JSON.stringify(row.vector),
            new Date().toISOString()
          );
        }
      });

      const rows = batch.map((c, idx) => ({
        repositoryId: c.repository_id,
        chunkId: c.id,
        relativePath: c.relative_path,
        vector: embeddings[idx],
      }));

      insertMany(rows);
      totalVectors += rows.length;
    } catch (err) {
      console.error(`\n  ✗ Error at batch ${i}: ${err.message}`);
      // Try one by one
      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        process.stdout.write(`\r  Retrying single: chunk ${i + j + 1}/${splitChunks.length}...`);
        try {
          const [embedding] = await embedTexts([c.text]);
          db.prepare(
            `INSERT OR REPLACE INTO vectors (repository_id, chunk_id, relative_path, model, dimensions, vector, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            c.repository_id,
            c.id,
            c.relative_path,
            EMBEDDING_MODEL,
            EMBEDDING_DIMS,
            JSON.stringify(embedding),
            new Date().toISOString()
          );
          totalVectors++;
        } catch (err2) {
          console.error(`\n  ✗ Chunk ${c.id.slice(0, 16)} failed: ${err2.message}`);
        }
      }
    }
  }

  const newCount = db
    .prepare("SELECT COUNT(*) as cnt FROM vectors")
    .get().cnt;
  console.log(`\n  ✓ ${newCount} vectors in DB`);
  db.close();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node scripts/backfill-vectors.mjs <topic-dir> [topic-dir...]");
    console.error("   or: node scripts/backfill-vectors.mjs --batch <dirs...>");
    process.exit(1);
  }
  const dirs = args.filter((a) => a !== "--batch");
  for (const dir of dirs) {
    await backfillVectors(dir);
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
