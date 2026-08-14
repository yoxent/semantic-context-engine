/**
 * Lexical candidate IDs for Free-plan semantic rerank.
 * Prefer precise AND matches, then distinctive terms, then OR.
 * Only chunks that already have embeddings are eligible.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { type SearchFilters, buildFilterClause } from "./d1";

export const CANDIDATE_LIMIT = 24;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "had", "has", "have", "how", "if", "in", "into", "is", "it",
  "its", "of", "on", "or", "the", "their", "this", "that", "to", "was", "were",
  "what", "when", "where", "which", "who", "why", "with", "you", "your",
]);

const WEAK_TERMS = new Set([
  "about", "after", "also", "based", "before", "just", "like", "more",
  "over", "some", "such", "than", "then", "using", "without",
]);

export function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function fieldMatchSql(wordCount: number, joiner: "AND" | "OR"): string {
  return Array.from({ length: wordCount }, () =>
    "(LOWER(chunks.text) LIKE ? OR LOWER(chunks.relative_path) LIKE ? OR LOWER(chunks.heading_path) LIKE ?)"
  ).join(` ${joiner} `);
}

function pushWordPatterns(params: unknown[], words: string[]): void {
  for (const word of words) {
    const pattern = `%${word}%`;
    params.push(pattern, pattern, pattern);
  }
}

function mergeIds(target: string[], seen: Set<string>, extra: string[], limit: number): void {
  for (const id of extra) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    target.push(id);
    if (target.length >= limit) {
      return;
    }
  }
}

async function selectChunkIds(
  db: D1Database,
  words: string[],
  joiner: "AND" | "OR",
  limit: number,
  filters?: SearchFilters
): Promise<string[]> {
  if (words.length === 0 || limit <= 0) {
    return [];
  }

  const params: unknown[] = [];
  const filterClause = buildFilterClause(filters ?? {}, params);
  const qualifiedFilter = filterClause
    .replace(/repository_id/g, "chunks.repository_id")
    .replace(/relative_path/g, "chunks.relative_path")
    .replace(/language/g, "chunks.language")
    .replace(/symbol_kind/g, "chunks.symbol_kind");
  const wordSql = fieldMatchSql(words.length, joiner);
  const sql = `
    SELECT chunks.id AS id
    FROM chunks
    INNER JOIN vectors ON vectors.chunk_id = chunks.id
    ${qualifiedFilter}
    ${qualifiedFilter ? "AND" : "WHERE"} ${wordSql}
      AND chunks.relative_path NOT LIKE '%node_modules%'
      AND chunks.relative_path NOT LIKE '%/dist/%'
    LIMIT ?
  `;
  pushWordPatterns(params, words);
  params.push(limit);

  const result = await db.prepare(sql).bind(...params).all();
  return result.results.map((row: Record<string, unknown>) => row.id as string);
}

export async function fetchCandidateChunkIds(
  db: D1Database,
  query: string,
  limit: number = CANDIDATE_LIMIT,
  filters?: SearchFilters
): Promise<string[]> {
  const words = queryWords(query);
  if (words.length === 0) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  mergeIds(ids, seen, await selectChunkIds(db, words, "AND", limit, filters), limit);
  if (ids.length >= limit || words.length === 1) {
    return ids;
  }

  const distinctive = words.filter((w) => w.length >= 5 && !WEAK_TERMS.has(w));
  if (distinctive.length > 0 && distinctive.length < words.length) {
    mergeIds(
      ids,
      seen,
      await selectChunkIds(db, distinctive, "AND", limit, filters),
      limit
    );
    if (ids.length >= limit) {
      return ids;
    }
    mergeIds(
      ids,
      seen,
      await selectChunkIds(db, distinctive, "OR", limit, filters),
      limit
    );
    if (ids.length >= limit) {
      return ids;
    }
  }

  mergeIds(ids, seen, await selectChunkIds(db, words, "OR", limit, filters), limit);
  return ids;
}
