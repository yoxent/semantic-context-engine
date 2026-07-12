export type SearchMode = "keyword" | "semantic" | "ast" | "hybrid";

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
