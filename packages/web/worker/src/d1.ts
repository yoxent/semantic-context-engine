/**
 * D1 query helpers and types for the SCE Worker.
 */

export interface D1Chunk {
  id: string;
  repository_id: string;
  relative_path: string;
  language: string | null;
  heading_path: string | null;
  start_line: number;
  end_line: number;
  text: string;
}

export interface D1Symbol {
  id: number;
  chunk_id: string;
  name: string;
  qualified_name: string | null;
  symbol_kind: string | null;
  relative_path: string;
  repository_id: string;
}

export interface D1Vector {
  chunk_id: string;
  embedding: string; // JSON-serialized number[]
}

export interface D1Config {
  key: string;
  value: string;
}

export interface SearchFilters {
  repositoryIds?: string[];
  pathFilter?: string;
  language?: string;
  symbolKind?: string;
}

/**
 * Build a WHERE clause fragment from search filters.
 * Mutates `params` by pushing bind values in order.
 * Returns the clause string (including WHERE keyword) or empty string.
 */
export function buildFilterClause(
  filters: SearchFilters,
  params: unknown[]
): string {
  const conditions: string[] = [];

  if (filters.repositoryIds && filters.repositoryIds.length > 0) {
    const placeholders = filters.repositoryIds.map(() => "?").join(", ");
    conditions.push(`repository_id IN (${placeholders})`);
    params.push(...filters.repositoryIds);
  }

  if (filters.pathFilter) {
    conditions.push("relative_path LIKE ?");
    params.push(`%${filters.pathFilter}%`);
  }

  if (filters.language) {
    conditions.push("language = ?");
    params.push(filters.language);
  }

  if (filters.symbolKind) {
    conditions.push("symbol_kind = ?");
    params.push(filters.symbolKind);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

/**
 * Build a filter clause for the symbols table (prefixed with s.).
 * Mutates `params` by pushing bind values in order.
 */
export function buildSymbolFilterClause(
  filters: SearchFilters,
  params: unknown[]
): string {
  const conditions: string[] = [];

  if (filters.repositoryIds && filters.repositoryIds.length > 0) {
    const placeholders = filters.repositoryIds.map(() => "?").join(", ");
    conditions.push(`s.repository_id IN (${placeholders})`);
    params.push(...filters.repositoryIds);
  }

  if (filters.pathFilter) {
    conditions.push("s.relative_path LIKE ?");
    params.push(`%${filters.pathFilter}%`);
  }

  if (filters.symbolKind) {
    conditions.push("s.symbol_kind = ?");
    params.push(filters.symbolKind);
  }

  return conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
}
