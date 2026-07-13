export const createSchemaSql = `
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  type TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  display_name TEXT
);

CREATE TABLE IF NOT EXISTS files (
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  PRIMARY KEY (repository_id, relative_path)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  text TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  heading_path_json TEXT NOT NULL,
  wiki_links_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunk_links (
  source_chunk_id TEXT NOT NULL,
  target TEXT NOT NULL,
  PRIMARY KEY (source_chunk_id, target)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED,
  repository_id UNINDEXED,
  relative_path,
  heading_path,
  text
);

CREATE TABLE IF NOT EXISTS vectors (
  repository_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (repository_id, chunk_id)
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  symbol_kind TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbols_repo_name ON symbols (repository_id, name);
CREATE INDEX IF NOT EXISTS idx_symbols_repo_kind_name ON symbols (repository_id, symbol_kind, name);
CREATE INDEX IF NOT EXISTS idx_symbols_repo_path ON symbols (repository_id, relative_path);
`;
