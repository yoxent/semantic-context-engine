export type SearchMode = "keyword" | "semantic" | "ast" | "hybrid";

/**
 * Search request. Keyword strategy honors optional filters:
 * - `repositoryIds`: restrict to these repository ids
 * - `pathFilter`: exact path, directory prefix (`notes` → `notes` + `notes/...`),
 *   or SQL GLOB (`*.md`, `notes/*`)
 * - `language`: exact language match (e.g. `markdown`)
 */
export interface SearchQuery {
  text: string;
  repositoryIds?: string[];
  mode?: SearchMode;
  limit?: number;
  pathFilter?: string;
  language?: string;
}

export interface SearchHit {
  chunkId: string;
  score: number;
  strategy: SearchMode;
  snippet: string;
  path: string;
  startLine: number;
  endLine: number;
  /** Vault heading ancestry when available (e.g. `["Storage", "SQLite"]`). */
  headingPath?: string[];
}

export interface SearchDiagnostics {
  strategy: SearchMode;
  elapsedMs?: number;
  scannedChunks?: number;
}

export interface SearchResult {
  hits: SearchHit[];
  diagnostics?: SearchDiagnostics;
}
