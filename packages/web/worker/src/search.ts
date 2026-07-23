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
  // Multi-part document fields
  partOf?: string;      // Original document chunk ID (if this is a split part)
  partIndex?: number;   // 0-based part number
  totalParts?: number;  // Total parts in this document
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
    SELECT id, relative_path, heading_path, text, language, part_index, total_parts, 1.0 AS score
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

  const baseHits = results.results.map((row: Record<string, unknown>) => ({
    chunkId: row.id as string,
    relativePath: row.relative_path as string,
    headingPath: (row.heading_path as string) ?? null,
    text: String(row.text).substring(0, 500),
    score: row.score as number,
    language: (row.language as string) ?? null,
    partIndex: (row.part_index as number) ?? undefined,
    totalParts: (row.total_parts as number) ?? undefined,
  }));

  return applyKeywordBoosts(baseHits, query);
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

  return applyKeywordBoosts(hits, query);
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
// Ranking helpers – filename / heading / snippet boosts
// ---------------------------------------------------------------------------

const TERM_RE = /[\p{L}\p{N}_]+/gu;

function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(TERM_RE), (m) => m[0]).filter(Boolean);
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function fileStem(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function applyKeywordBoosts(hits: SearchHit[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  const terms = tokenize(query);

  return hits.map((hit) => {
    let score = hit.score;
    const fileName = fileNameFromPath(hit.relativePath).toLowerCase();
    const stem = fileStem(fileName);
    const snippetLower = hit.text.toLowerCase();
    const headingLower = (hit.headingPath ?? "").toLowerCase();

    // Filename match (+5)
    if (fileName.includes(needle) || stem === needle || terms.some((t) => stem === t || fileName.includes(t))) {
      score += 5;
    }

    // Heading match (+4)
    if (headingLower.includes(needle) || terms.some((t) => headingLower.includes(t))) {
      score += 4;
    }

    // Snippet exact match (+2)
    if (snippetLower.includes(needle)) {
      score += 2;
    }

    return { ...hit, score };
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Multi-part document expansion
// ---------------------------------------------------------------------------

/** Detect if a chunk text is a split part by checking continuation pointers. */
function detectSplitPart(text: string): { partIndex: number; totalParts: number } | null {
  const continuesMatch = text.match(/Continues in Part (\d+) of (\d+)/);
  if (continuesMatch) {
    return { partIndex: parseInt(continuesMatch[1]) - 2, totalParts: parseInt(continuesMatch[2]) };
  }
  const endMatch = text.match(/Part (\d+) of (\d+) \(end\)/);
  if (endMatch) {
    return { partIndex: parseInt(endMatch[1]) - 1, totalParts: parseInt(endMatch[2]) };
  }
  return null;
}

/** Fetch all parts of a split document given its relativePath. */
async function fetchSiblingParts(
  db: D1Database,
  relativePath: string,
): Promise<SearchHit[]> {
  const sql = `
    SELECT id, relative_path, heading_path, text, language, part_index, total_parts
    FROM chunks
    WHERE relative_path = ?
      AND total_parts IS NOT NULL
    ORDER BY part_index, id
  `;
  const results = await db.prepare(sql).bind(relativePath).all();
  return results.results.map((row: Record<string, unknown>) => ({
    chunkId: row.id as string,
    relativePath: row.relative_path as string,
    headingPath: (row.heading_path as string) ?? null,
    text: String(row.text).substring(0, 500),
    score: 0.5,
    language: (row.language as string) ?? null,
    partIndex: (row.part_index as number) ?? 0,
    totalParts: (row.total_parts as number) ?? 1,
  }));
}

/** Expand search results to include all parts of split documents. */
async function expandPartResults(
  db: D1Database,
  hits: SearchHit[],
  limit: number,
): Promise<SearchHit[]> {
  const expanded: SearchHit[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    if (seen.has(hit.chunkId)) continue;
    seen.add(hit.chunkId);

    // Check if this chunk has part metadata in the database
    const partCheck = await db.prepare(
      "SELECT total_parts FROM chunks WHERE id = ? AND total_parts IS NOT NULL"
    ).bind(hit.chunkId).first();
    
    if (partCheck) {
      // This is a split part — fetch all siblings (don't break, include all parts)
      const siblings = await fetchSiblingParts(db, hit.relativePath);
      if (siblings.length > 1) {
        // Add the original hit first, then siblings
        expanded.push(hit);
        for (const s of siblings) {
          if (!seen.has(s.chunkId)) {
            seen.add(s.chunkId);
            expanded.push(s);
          }
        }
      } else {
        expanded.push(hit);
      }
    } else {
      expanded.push(hit);
      if (expanded.length >= limit) break;
    }
  }
  // Don't truncate if we expanded any split parts — return all parts of matching docs
  const hasSplitParts = expanded.some(h => h.totalParts && h.totalParts > 1);
  return hasSplitParts ? expanded : expanded.slice(0, limit);
}

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

  // Expand multi-part results: if a hit is a split chunk, fetch all parts
  hits = await expandPartResults(db, hits, limit);

  return {
    query,
    mode,
    hits,
    totalHits: hits.length,
    searchTimeMs: Date.now() - startTime,
  };
}
