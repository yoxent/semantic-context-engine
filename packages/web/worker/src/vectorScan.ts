/**
 * Score a small set of D1 embeddings with cosine similarity.
 *
 * Full-corpus scans exceed Workers Free CPU (10ms) and D1 result memory.
 * The public demo only reranks lexical candidate IDs, fetched in small IN batches.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { cosineSimilarity } from "./cosine";

/** Embeddings per D1 query. Each 2048-dim JSON row is ~40KB. */
export const VECTOR_BATCH_SIZE = 8;
const MIN_VECTOR_BATCH_SIZE = 1;

export interface VectorScore {
  chunkId: string;
  score: number;
}

function isD1MemoryLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /memory limit exceeded/i.test(message);
}

async function fetchEmbeddingBatch(
  db: D1Database,
  chunkIds: string[]
): Promise<Record<string, unknown>[]> {
  if (chunkIds.length === 0) {
    return [];
  }
  const placeholders = chunkIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT chunk_id, embedding FROM vectors WHERE chunk_id IN (${placeholders})`
    )
    .bind(...chunkIds)
    .all();
  return result.results as Record<string, unknown>[];
}

/**
 * Cosine-score stored vectors for the given chunk IDs only.
 */
export async function scoreVectorsForIds(
  db: D1Database,
  queryEmbedding: number[],
  chunkIds: string[],
  batchSize: number = VECTOR_BATCH_SIZE
): Promise<VectorScore[]> {
  const uniqueIds = [...new Set(chunkIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const scores: VectorScore[] = [];
  let size = Math.max(MIN_VECTOR_BATCH_SIZE, batchSize);
  let offset = 0;

  while (offset < uniqueIds.length) {
    const batch = uniqueIds.slice(offset, offset + size);
    let rows: Record<string, unknown>[];
    try {
      rows = await fetchEmbeddingBatch(db, batch);
    } catch (error) {
      if (isD1MemoryLimitError(error) && size > MIN_VECTOR_BATCH_SIZE) {
        size = Math.max(MIN_VECTOR_BATCH_SIZE, Math.floor(size / 2));
        continue;
      }
      throw error;
    }

    for (const row of rows) {
      const embedding = JSON.parse(row.embedding as string) as number[];
      if (embedding.length !== queryEmbedding.length) {
        continue;
      }
      scores.push({
        chunkId: row.chunk_id as string,
        score: cosineSimilarity(queryEmbedding, embedding),
      });
    }

    offset += batch.length;
  }

  return scores;
}
