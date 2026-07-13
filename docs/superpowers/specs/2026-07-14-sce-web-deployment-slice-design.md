# SCE Web Deployment Slice — Design Spec

**Date:** 2026-07-14
**Status:** Draft
**Goal:** Deploy SCE as a live, accessible semantic search engine with a web frontend

## Overview

Deploy SCE to a Cloudflare subdomain with a working web UI that demonstrates:
1. A functional semantic search engine (keyword, semantic, hybrid, AST modes)
2. Knowledge architecture thinking (how SCE chunks, indexes, and retrieves)
3. AI-ready knowledge retrieval (searchable by both humans and agents)

**Target audience:** Hiring manager for AI Knowledge Systems Architect role at Remote CoWorker.
**Narrative:** "I built a semantic knowledge retrieval system. Here it is running over Atlassian's documentation — the same platform your teams use. This is the architecture I'd apply to build your Notion Business Brain."

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Cloudflare Pages)                                │
│  Static HTML/JS — search box, mode selector, results        │
└──────────────────────┬──────────────────────────────────────┘
                       │ fetch('/api/search?q=...&mode=...')
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  API (Cloudflare Worker)                                    │
│  Routes: /api/search, /api/stats                            │
│  Reads from D1, returns JSON                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL queries
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  D1 Database (Cloudflare)                                   │
│  Tables: chunks, symbols, vectors (pre-computed)            │
└─────────────────────────────────────────────────────────────┘
```

### Indexing Pipeline (local, not deployed)

```
┌─────────────────────────────────────────────────────────────┐
│  Local SCE Runtime                                          │
│  1. Discover files (markdown, code)                         │
│  2. Chunk (TreeSitterCodeChunker, MarkdownChunker)          │
│  3. Embed via OpenRouter API                                │
│     - Model: nvidia/llama-nemotron-embed-vl-1b-v2:free      │
│     - Dimensions: 2048                                      │
│     - Cost: $0                                              │
│  4. Store in SQLite (.sce/metadata.sqlite + vectors)        │
│  5. Export to JSON for D1 import                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ export
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Export Artifacts                                            │
│  - chunks.json   (id, text, metadata, headingPath)          │
│  - vectors.json  (chunkId, embedding[])                     │
│  - symbols.json  (name, kind, qualifiedName, path)          │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Embedding Configuration

**File:** `sce.config.json`

```json
{
  "embedding": {
    "provider": "openai-compatible",
    "baseUrl": "https://openrouter.ai/api/v1",
    "model": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    "dimensions": 2048,
    "batchSize": 20,
    "apiKeyEnv": "OPENROUTER_API_KEY"
  },
  "indexing": {
    "include": ["**/*.md"]
  }
}
```

**Notes:**
- `apiKeyEnv` reads from environment variable (not hardcoded)
- `batchSize: 20` — OpenRouter free tier may have rate limits; conservative batch size
- `dimensions: 2048` — matches the model output

### 2. Index Exporter

New CLI command: `sce export`

**Responsibilities:**
- Read from SQLite (chunks, vectors, symbols)
- Serialize to JSON files
- Output to `./sce-export/` directory

**Output format:**

```json
// chunks.json
[
  {
    "id": "chunk_abc123",
    "repositoryId": "repo_1",
    "relativePath": "docs/search.md",
    "language": "markdown",
    "headingPath": "Search > Semantic Search",
    "startLine": 10,
    "endLine": 25,
    "text": "Semantic search uses vector embeddings..."
  }
]

// vectors.json
[
  {
    "chunkId": "chunk_abc123",
    "embedding": [0.012, -0.034, ...]  // 2048 floats
  }
]

// symbols.json
[
  {
    "id": "sym_xyz",
    "chunkId": "chunk_abc123",
    "name": "SemanticSearch",
    "qualifiedName": "Search.SemanticSearch",
    "symbolKind": "class",
    "relativePath": "docs/search.md",
    "repositoryId": "repo_1"
  }
]

// meta.json
{
  "exportedAt": "2026-07-14T12:00:00Z",
  "chunkCount": 1234,
  "vectorCount": 1234,
  "symbolCount": 56,
  "embeddingModel": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
  "embeddingDimensions": 2048
}
```

### 3. D1 Schema

```sql
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT,
  heading_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE symbols (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT,
  symbol_kind TEXT,
  relative_path TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);

CREATE TABLE vectors (
  chunk_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);

-- Indexes for search performance
CREATE INDEX idx_chunks_repo_path ON chunks(repository_id, relative_path);
CREATE INDEX idx_chunks_language ON chunks(language);
CREATE INDEX idx_symbols_name ON symbols(repository_id, name);
CREATE INDEX idx_symbols_kind ON symbols(repository_id, symbol_kind, name);
```

**Vector storage:** Embeddings stored as JSON arrays in BLOB columns. For 2048 dimensions at float32, each vector is ~8KB. At 10,000 chunks, that's ~80MB — well within D1 limits.

### 4. Cloudflare Worker (API)

**Endpoints:**

```
GET /api/search?q=<query>&mode=<mode>&limit=<limit>&symbolKind=<kind>&pathFilter=<filter>&language=<lang>

GET /api/stats
```

**Search response:**

```json
{
  "query": "How does semantic search work?",
  "mode": "semantic",
  "hits": [
    {
      "chunkId": "chunk_abc123",
      "relativePath": "docs/search.md",
      "headingPath": "Search > Semantic Search",
      "text": "Semantic search uses vector embeddings...",
      "score": 0.85,
      "language": "markdown",
      "symbolKind": null
    }
  ],
  "totalHits": 42,
  "searchTimeMs": 15
}
```

**Search modes:**

| Mode | Strategy | Query processing |
|------|----------|------------------|
| `keyword` | FTS5 match on chunks.text | Direct SQL LIKE/FTS |
| `semantic` | Cosine similarity over vectors | Load query embedding, compute similarities |
| `hybrid` | RRF fusion of keyword + semantic | Run both, fuse with k=60 |
| `ast` | Symbol name lookup | Prefix/exact match on symbols table |

**Semantic search implementation:**
- At query time, the Worker does NOT call OpenRouter (no embedding API key in production)
- Instead, we pre-compute query embeddings during a "query preprocessing" step
- **Actually, simpler approach:** The Worker stores pre-computed embeddings in D1 and does cosine similarity in SQL/JS

**Wait — this is a problem.** Semantic search requires embedding the query at search time. Options:

1. **Pre-compute common queries** — not practical, queries are unpredictable
2. **Embed query in Worker** — requires OpenRouter API key in Worker secrets
3. **Hybrid only with keyword+AST** — skip semantic in deployment, show it locally
4. **Use D1 vector functions** — D1 doesn't have native vector search yet

**Decision:** Embed the OpenRouter API key as a Worker secret. The Worker calls OpenRouter at query time to embed the query, then computes cosine similarity against stored vectors in D1.

**Updated semantic search flow:**
```
1. User query arrives at Worker
2. Worker calls OpenRouter API to embed query (cost: $0)
3. Worker loads all vectors from D1 (or a subset by language/path)
4. Worker computes cosine similarity in JS
5. Worker returns top-k results
```

**Performance note:** For a demo with ~10K chunks, loading all vectors and computing similarity in JS is feasible (~100ms). For production, we'd use an ANN index.

### 5. Frontend

**Minimal search interface:**

```
┌─────────────────────────────────────────────────────────────┐
│  SCE — Semantic Context Engine                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Search query...                              [Search]│    │
│  └─────────────────────────────────────────────────────┘    │
│  [Keyword] [Semantic] [Hybrid] [AST]                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ docs/search.md > Semantic Search                    │    │
│  │ Score: 0.85 | markdown                              │    │
│  │ Semantic search uses vector embeddings to find...    │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ src/retrieval/SemanticRetrievalStrategy.ts           │    │
│  │ Score: 0.72 | typescript                            │    │
│  │ export class SemanticRetrievalStrategy implements...  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  42 results | 15ms | Search powered by SCE                  │
└─────────────────────────────────────────────────────────────┘
```

**Tech stack:**
- Vanilla HTML/CSS/JS (no framework, no build step)
- Deployed as static files on Cloudflare Pages
- Calls `/api/search` and `/api/stats` endpoints
- Responsive design (works on mobile)

**Features:**
- Mode selector (keyword, semantic, hybrid, AST)
- Results with path, heading, score, language
- Text preview with query highlighting
- Stats display (total chunks, index size, last updated)

## Deployment

### Prerequisites
- Cloudflare account (free tier)
- Wrangler CLI installed
- OpenRouter API key

### Steps

1. **Create D1 database**
   ```bash
   wrangler d1 create sce-db
   ```

2. **Apply schema**
   ```bash
   wrangler d1 execute sce-db --file=schema.sql
   ```

3. **Import data**
   ```bash
   wrangler d1 execute sce-db --command="INSERT INTO chunks..."
   # Or use a import script
   ```

4. **Deploy Worker**
   ```bash
   wrangler deploy
   ```

5. **Set Worker secrets**
   ```bash
   wrangler secret put OPENROUTER_API_KEY
   ```

6. **Deploy Frontend**
   ```bash
   wrangler pages deploy ./frontend
   ```

7. **Configure subdomain**
   - Point `sce.xent-xent.workers.dev` to the Worker
   - Or use `workers.dev` subdomain directly

### File structure

```
packages/
  web/
    worker/
      src/
        index.ts          # Worker entry point
        search.ts         # Search logic
        d1.ts             # D1 helpers
      wrangler.toml       # Worker config
    frontend/
      index.html          # Search UI
      style.css           # Styles
      app.js              # Frontend logic
    schema.sql            # D1 schema
    import.ts             # Data import script
```

## Content Strategy

### Phase 1: SCE Docs (validate)
- Index SCE's own README, specs, architecture docs
- ~50-100 markdown files
- Validates the full pipeline end-to-end

### Phase 2: Atlassian Docs (live demo)
- Source: Atlassian public documentation (Confluence, Jira, Bitbucket)
- Format: Scrape to markdown, or find public markdown sources
- Target: ~500-1000 documents
- Narrative: "Indexed Atlassian's documentation — Confluence is listed in your job requirements"

## Out of Scope (this slice)

- AST in hybrid mode (third RRF list)
- Binary vector layout / ANN index
- Cloud-only embedding providers beyond OpenRouter
- Human Obsidian-like UI (future slice)
- Call hierarchy, references, inheritance
- User authentication / multi-tenancy
- Real-time indexing (all indexing is local, export is manual)

## Testing

### Local validation
- Index SCE docs with OpenRouter embeddings
- Verify search returns relevant results for test queries:
  - "How does semantic search work?" (semantic mode)
  - "SemanticSearch" (AST mode)
  - "vector embedding" (keyword mode)
  - "How do I configure embeddings?" (hybrid mode)

### Deployment validation
- Deploy Worker + D1 + Frontend
- Verify search works end-to-end
- Check response times (<500ms for keyword, <2s for semantic)
- Verify free tier limits not exceeded

## Success Criteria

1. ✅ Live at `sce.xent-xent.workers.dev` (or subdomain)
2. ✅ Search works in all 4 modes
3. ✅ Atlassian docs indexed and searchable
4. ✅ Response times acceptable (<500ms keyword, <2s semantic)
5. ✅ Free tier only (no costs)
6. ✅ Demo-able in interview setting

## Risks

| Risk | Mitigation |
|------|------------|
| D1 vector search slow at scale | Start with ~1K chunks; optimize later |
| OpenRouter rate limits | Batch embeddings, cache aggressively |
| Atlassian scraping blocked | Use public API or find markdown sources |
| Worker cold start latency | Keep Worker warm with cron, or accept 1-2s first request |

## Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| OpenRouter API unavailable | Return error message: "Semantic search temporarily unavailable. Try keyword mode." |
| OpenRouter rate limited | Return 429 with retry-after header |
| Empty query | Return 400: "Query is required" |
| Query too long (>10K chars) | Truncate with warning in response |
| No results found | Return empty hits array, not error |
| D1 unavailable | Return 503: "Service temporarily unavailable" |
| Embedding dimension mismatch | Reject at startup, log error: "Model changed — re-index required" |

## Semantic Search Optimization

**Problem:** Loading all vectors for cosine similarity is O(n).

**Mitigation for demo:**
1. **Pre-filter by language/path** — if user specifies `language=markdown`, only load vectors for markdown chunks (reduces row count by ~70%)
2. **Cache query embeddings** — cache last N query embeddings in Worker memory (repeated queries hit cache)
3. **Target ~1K chunks** — Atlassian docs should be ~500-1000 documents, well within D1 limits

**D1 free tier math:**
- 5M row reads/day
- 1K chunks per query = 1K rows
- 5,000 semantic queries/day before limit
- Sufficient for demo

## Data Import Design

**Script:** `packages/web/import.ts`

**Batching strategy:**
- D1 max statement size: 100KB
- Each chunk ~1KB, each vector ~16KB (JSON array)
- Batch size: 50 chunks per statement, 10 vectors per statement
- Idempotent: use `INSERT OR REPLACE` to handle re-imports

**Import flow:**
```
1. Read export JSON files
2. Validate schema (chunk IDs match vector IDs)
3. Batch chunks into statements (50 per batch)
4. Execute statements sequentially
5. Batch vectors separately (10 per batch)
6. Verify counts match
7. Log summary
```

## AST Search in D1

Port existing `SqliteSymbolIndex` tiered matching logic:

```sql
-- Exact match first
SELECT * FROM symbols
WHERE repository_id = ? AND name = ?
LIMIT ?

-- If no exact matches, prefix match
SELECT * FROM symbols
WHERE repository_id = ? AND name LIKE ? || '%'
ORDER BY LENGTH(name) ASC
LIMIT ?
```

Filters: `repositoryIds`, `pathFilter`, `language`, `symbolKind` — same as existing implementation.

## Model Version Tracking

**Table:** `embedding_config`

```sql
CREATE TABLE embedding_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Stored values:**
- `model` — model ID used for embedding
- `dimensions` — embedding dimensions
- `exported_at` — when the export was created

**Validation:** On import, check if stored model matches current config. If mismatch, reject with: "Model changed — re-index required. Run `sce export` with the new model."

## Open Questions

1. **Atlassian content source:** Do they have public markdown docs, or do we need to scrape HTML?
2. **Subdomain:** Use `sce.xent-xent.workers.dev` or configure a custom subdomain?
3. **Frontend polish:** Minimal MVP first, or invest in visual polish for the demo?
