/**
 * Search implementation with four modes: keyword, semantic, hybrid, AST.
 *
 * - keyword  : SQL LIKE over text, path, and heading
 * - semantic : OpenRouter embedding → cosine similarity over all vectors
 * - hybrid   : keyword + semantic fused with Reciprocal Rank Fusion (k=60)
 * - ast      : symbol table lookup – exact match first, then prefix fallback
 *
 * All modes respect SearchFilters (repositoryIds, pathFilter, language, symbolKind).
 */

import type { D1Database } from "@cloudflare/workers-types";
import { cosineSimilarity } from "./cosine";
import { embedQuery, type EmbeddingEnv } from "./embedding";
import {
  type SearchFilters,
  buildFilterClause,
  buildSymbolFilterClause,
} from "./d1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchMode = "keyword" | "semantic" | "hybrid" | "ast";

export interface SearchQuery {
  query: string;
  mode: SearchMode;
  limit?: number;
  filters?: SearchFilters;
}

export interface SearchHit {
  chunkId: string;
  relativePath: string;
  headingPath: string | null;
  text: string;
  score: number;
  language: string | null;
  symbolKind?: string | null;
}

export interface SearchResult {
  query: string;
  mode: SearchMode;
  hits: SearchHit[];
  totalHits: number;
  searchTimeMs: number;
}

// ---------------------------------------------------------------------------
// Keyword search
// ---------------------------------------------------------------------------

async function keywordSearch(
  db: D1Database,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  const params: unknown[] = [];
  const filterClause = buildFilterClause(filters ?? {}, params);

  const searchPattern = `%${query}%`;

  const sql = `
    SELECT id, relative_path, heading_path, text, language, 1.0 AS score
    FROM chunks
    ${filterClause}
    ${filterClause ? "AND" : "WHERE"} (
      text LIKE ?
      OR relative_path LIKE ?
      OR heading_path LIKE ?
    )
    ORDER BY score DESC
    LIMIT ?
  `;

  params.push(searchPattern, searchPattern, searchPattern, limit);

  const results = await db.prepare(sql).bind(...params).all();

  return results.results.map((row: Record<string, unknown>) => ({
    chunkId: row.id as string,
    relativePath: row.relative_path as string,
    headingPath: (row.heading_path as string) ?? null,
    text: String(row.text).substring(0, 500),
    score: row.score as number,
    language: (row.language as string) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

async function semanticSearch(
  db: D1Database,
  env: EmbeddingEnv,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  const queryEmbedding = await embedQuery(env, query);

  const params: unknown[] = [];
  const filterClause = buildFilterClause(filters ?? {}, params);

  let sql: string;
  let allParams: unknown[];

  if (filterClause) {
    sql = `
      SELECT v.chunk_id, v.embedding
      FROM vectors v
      JOIN chunks c ON v.chunk_id = c.id
      ${filterClause}
    `;
    allParams = params;
  } else {
    sql = "SELECT chunk_id, embedding FROM vectors";
    allParams = [];
  }

  const vectorRows = await db.prepare(sql).bind(...allParams).all();

  const similarities = vectorRows.results.map(
    (row: Record<string, unknown>) => {
      const embedding = JSON.parse(row.embedding as string) as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);
      return { chunkId: row.chunk_id as string, score };
    }
  );

  similarities.sort((a, b) => b.score - a.score);
  const topK = similarities.slice(0, limit);

  const hits: SearchHit[] = [];
  for (const sim of topK) {
    const chunk = await db
      .prepare(
        "SELECT id, relative_path, heading_path, text, language FROM chunks WHERE id = ?"
      )
      .bind(sim.chunkId)
      .first();

    if (chunk) {
      hits.push({
        chunkId: chunk.id as string,
        relativePath: chunk.relative_path as string,
        headingPath: (chunk.heading_path as string) ?? null,
        text: String(chunk.text).substring(0, 500),
        score: sim.score,
        language: (chunk.language as string) ?? null,
      });
    }
  }

  return hits;
}

// ---------------------------------------------------------------------------
// AST (symbol) search – tiered: exact then prefix
// ---------------------------------------------------------------------------

async function astSearch(
  db: D1Database,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  const params: unknown[] = [];
  const whereExtra = buildSymbolFilterClause(filters ?? {}, params);

  // --- Tier 1: exact match on symbol name ---
  const exactSql = `
    SELECT s.id, s.name, s.qualified_name, s.symbol_kind, s.relative_path,
           c.id AS chunk_id, c.heading_path, c.text, c.language,
           1.0 AS score
    FROM symbols s
    JOIN chunks c ON s.chunk_id = c.id
    WHERE s.name = ?
    ${whereExtra}
    LIMIT ?
  `;

  let results = await db
    .prepare(exactSql)
    .bind(query, ...params, limit)
    .all();

  if (results.results.length > 0) {
    return results.results.map((row: Record<string, unknown>) => ({
      chunkId: row.chunk_id as string,
      relativePath: row.relative_path as string,
      headingPath: (row.heading_path as string) ?? null,
      text: String(row.text).substring(0, 500),
      score: row.score as number,
      language: (row.language as string) ?? null,
      symbolKind: (row.symbol_kind as string) ?? null,
    }));
  }

  // --- Tier 2: prefix match (name LIKE 'query%') ---
  const prefixParams: unknown[] = [];
  const prefixExtra = buildSymbolFilterClause(filters ?? {}, prefixParams);

  const prefixSql = `
    SELECT s.id, s.name, s.qualified_name, s.symbol_kind, s.relative_path,
           c.id AS chunk_id, c.heading_path, c.text, c.language,
           0.5 + (0.5 * LENGTH(?) / LENGTH(s.name)) AS score
    FROM symbols s
    JOIN chunks c ON s.chunk_id = c.id
    WHERE s.name LIKE ? || '%'
    ${prefixExtra}
    ORDER BY LENGTH(s.name) ASC
    LIMIT ?
  `;

  results = await db
    .prepare(prefixSql)
    .bind(query, query, ...prefixParams, limit)
    .all();

  return results.results.map((row: Record<string, unknown>) => ({
    chunkId: row.chunk_id as string,
    relativePath: row.relative_path as string,
    headingPath: (row.heading_path as string) ?? null,
    text: String(row.text).substring(0, 500),
    score: row.score as number,
    language: (row.language as string) ?? null,
    symbolKind: (row.symbol_kind as string) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Hybrid search – RRF fusion (k = 60)
// ---------------------------------------------------------------------------

const RRF_K = 60;

async function hybridSearch(
  db: D1Database,
  env: EmbeddingEnv,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  const fetchCount = limit * 2;

  const [keywordHits, semanticHits] = await Promise.all([
    keywordSearch(db, query, fetchCount, filters),
    semanticSearch(db, env, query, fetchCount, filters),
  ]);

  const scores = new Map<string, number>();

  keywordHits.forEach((hit, rank) => {
    scores.set(
      hit.chunkId,
      (scores.get(hit.chunkId) ?? 0) + 1 / (RRF_K + rank + 1)
    );
  });

  semanticHits.forEach((hit, rank) => {
    scores.set(
      hit.chunkId,
      (scores.get(hit.chunkId) ?? 0) + 1 / (RRF_K + rank + 1)
    );
  });

  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const allHits = new Map<string, SearchHit>();
  for (const hit of [...keywordHits, ...semanticHits]) {
    allHits.set(hit.chunkId, hit);
  }

  return sorted.map(([chunkId, score]) => ({
    ...allHits.get(chunkId)!,
    score,
  }));
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function search(
  db: D1Database,
  env: EmbeddingEnv,
  query: string,
  mode: SearchMode,
  limit: number = 20,
  filters?: SearchFilters
): Promise<SearchResult> {
  const startTime = Date.now();
  let hits: SearchHit[] = [];

  switch (mode) {
    case "keyword":
      hits = await keywordSearch(db, query, limit, filters);
      break;
    case "semantic":
      hits = await semanticSearch(db, env, query, limit, filters);
      break;
    case "hybrid":
      hits = await hybridSearch(db, env, query, limit, filters);
      break;
    case "ast":
      hits = await astSearch(db, query, limit, filters);
      break;
  }

  return {
    query,
    mode,
    hits,
    totalHits: hits.length,
    searchTimeMs: Date.now() - startTime,
  };
}
