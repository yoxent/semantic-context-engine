-- D1 Schema for SCE Web Deployment
-- Idempotent: uses IF NOT EXISTS throughout

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT,
  heading_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  text TEXT NOT NULL,
  part_index INTEGER,
  total_parts INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY,
  chunk_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT,
  symbol_kind TEXT,
  relative_path TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);

CREATE TABLE IF NOT EXISTS vectors (
  chunk_id TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);

CREATE TABLE IF NOT EXISTS embedding_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS idx_chunks_repo_path ON chunks(repository_id, relative_path);
CREATE INDEX IF NOT EXISTS idx_chunks_language ON chunks(language);
CREATE INDEX IF NOT EXISTS idx_chunks_heading ON chunks(heading_path);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(repository_id, name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(repository_id, symbol_kind, name);
CREATE INDEX IF NOT EXISTS idx_symbols_chunk ON symbols(chunk_id);
