# SCE Web Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy SCE as a live semantic search engine on Cloudflare with a web frontend, indexed over Atlassian documentation.

**Architecture:** Local indexing with OpenRouter embeddings → export to JSON → import to Cloudflare D1 → Cloudflare Worker serves search API → static frontend on Pages.

**Tech Stack:** Cloudflare Worker, D1, Pages, OpenRouter API (nvidia/llama-nemotron-embed-vl-1b-v2:free), vanilla HTML/CSS/JS.

## Global Constraints

- Embedding model: `nvidia/llama-nemotron-embed-vl-1b-v2:free` (2048 dimensions, $0)
- D1 free tier: 5GB storage, 5M reads/day, 100K writes/day
- Worker free tier: 100K requests/day
- No API keys in client-side code
- All search modes must work: keyword, semantic, hybrid, AST
- Index must be idempotent (re-import overwrites cleanly)

---

## File Structure

```
packages/
  web/
    worker/
      src/
        index.ts              # Worker entry point, routing
        search.ts             # Search orchestration (keyword, semantic, hybrid, AST)
        d1.ts                 # D1 query helpers
        embedding.ts          # OpenRouter embedding client
        cosine.ts             # Cosine similarity computation
      wrangler.toml           # Worker config
      package.json
    frontend/
      index.html              # Search UI
      style.css               # Styles
      app.js                  # Frontend logic
    schema.sql                # D1 schema
    import.ts                 # Data import script
    export.ts                 # SCE export CLI command
  cli/
    src/
      commands/
        export.ts             # Export command implementation
```

---

## Task 1: Add SCE Export Command

**Files:**
- Create: `packages/cli/src/commands/export.ts`
- Create: `packages/core/src/export.ts`
- Modify: `packages/cli/src/index.ts` (add export command)

**Interfaces:**
- Consumes: `IStorage` (chunks, vectors, symbols)
- Produces: `ExportResult { chunksPath, vectorsPath, symbolsPath, metaPath }`

- [ ] **Step 1: Create export types in core**

```typescript
// packages/core/src/export.ts
export interface ExportedChunk {
  id: string;
  repositoryId: string;
  relativePath: string;
  language: string | null;
  headingPath: string | null;
  startLine: number;
  endLine: number;
  text: string;
}

export interface ExportedVector {
  chunkId: string;
  embedding: number[];
}

export interface ExportedSymbol {
  id: string;
  chunkId: string;
  name: string;
  qualifiedName: string | null;
  symbolKind: string | null;
  relativePath: string;
  repositoryId: string;
}

export interface ExportMeta {
  exportedAt: string;
  chunkCount: number;
  vectorCount: number;
  symbolCount: number;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface ExportResult {
  outputDir: string;
  chunksPath: string;
  vectorsPath: string;
  symbolsPath: string;
  metaPath: string;
  meta: ExportMeta;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/export.ts
git commit -m "feat(core): add export types"
```

- [ ] **Step 3: Create export implementation in core**

```typescript
// packages/core/src/export.ts (append)
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function exportIndex(
  storage: IStorage,
  embeddingModel: string,
  embeddingDimensions: number,
  outputDir: string
): Promise<ExportResult> {
  await mkdir(outputDir, { recursive: true });

  // Export chunks
  const chunks = await storage.getAllChunks();
  const exportedChunks: ExportedChunk[] = chunks.map(c => ({
    id: c.id,
    repositoryId: c.repositoryId,
    relativePath: c.relativePath,
    language: c.language ?? null,
    headingPath: c.headingPath ?? null,
    startLine: c.startLine,
    endLine: c.endLine,
    text: c.text,
  }));

  // Export vectors
  const vectors = await storage.getAllVectors();
  const exportedVectors: ExportedVector[] = vectors.map(v => ({
    chunkId: v.chunkId,
    embedding: Array.from(v.embedding),
  }));

  // Export symbols
  const symbols = await storage.getAllSymbols();
  const exportedSymbols: ExportedSymbol[] = symbols.map(s => ({
    id: s.id,
    chunkId: s.chunkId,
    name: s.name,
    qualifiedName: s.qualifiedName ?? null,
    symbolKind: s.symbolKind ?? null,
    relativePath: s.relativePath,
    repositoryId: s.repositoryId,
  }));

  const meta: ExportMeta = {
    exportedAt: new Date().toISOString(),
    chunkCount: exportedChunks.length,
    vectorCount: exportedVectors.length,
    symbolCount: exportedSymbols.length,
    embeddingModel,
    embeddingDimensions,
  };

  const chunksPath = join(outputDir, 'chunks.json');
  const vectorsPath = join(outputDir, 'vectors.json');
  const symbolsPath = join(outputDir, 'symbols.json');
  const metaPath = join(outputDir, 'meta.json');

  await writeFile(chunksPath, JSON.stringify(exportedChunks, null, 2));
  await writeFile(vectorsPath, JSON.stringify(exportedVectors, null, 2));
  await writeFile(symbolsPath, JSON.stringify(exportedSymbols, null, 2));
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  return { outputDir, chunksPath, vectorsPath, symbolsPath, metaPath, meta };
}
```

- [ ] **Step 4: Add export command to CLI**

```typescript
// packages/cli/src/commands/export.ts
import { Command } from 'commander';
import { createStorage } from '@sce/storage';
import { exportIndex } from '@sce/core';
import { resolve } from 'path';

export const exportCommand = new Command('export')
  .description('Export index to JSON for D1 import')
  .option('-o, --output <dir>', 'Output directory', './sce-export')
  .option('-m, --model <model>', 'Embedding model ID', 'nvidia/llama-nemotron-embed-vl-1b-v2:free')
  .option('-d, --dimensions <n>', 'Embedding dimensions', '2048')
  .action(async (options) => {
    const dbPath = resolve('.sce/metadata.sqlite');
    const storage = await createStorage({ dbPath });

    const result = await exportIndex(
      storage,
      options.model,
      parseInt(options.dimensions),
      resolve(options.output)
    );

    console.log('Export complete:');
    console.log(`  Chunks: ${result.meta.chunkCount}`);
    console.log(`  Vectors: ${result.meta.vectorCount}`);
    console.log(`  Symbols: ${result.meta.symbolCount}`);
    console.log(`  Output: ${result.outputDir}`);
  });
```

- [ ] **Step 5: Register export command in CLI index**

```typescript
// packages/cli/src/index.ts (add import and command)
import { exportCommand } from './commands/export';

program.addCommand(exportCommand);
```

- [ ] **Step 6: Add getAllChunks, getAllVectors, getAllSymbols to storage**

Check if these methods exist in `@sce/storage`. If not, add them to `SqliteStorage`:

```typescript
// packages/storage/src/sqlite-storage.ts
async getAllChunks(): Promise<Chunk[]> {
  return this.db.prepare('SELECT * FROM chunks').all();
}

async getAllVectors(): Promise<{ chunkId: string; embedding: Float32Array }[]> {
  const rows = this.db.prepare('SELECT chunk_id, embedding FROM vectors').all();
  return rows.map(row => ({
    chunkId: row.chunk_id,
    embedding: new Float32Array(row.embedding),
  }));
}

async getAllSymbols(): Promise<Symbol[]> {
  return this.db.prepare('SELECT * FROM symbols').all();
}
```

- [ ] **Step 7: Run export on SCE docs**

```bash
cd packages/cli
npx sce export -o ../../sce-export
```

Expected: Creates `sce-export/` with 4 JSON files.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/commands/export.ts packages/core/src/export.ts packages/cli/src/index.ts
git commit -m "feat(cli): add export command for D1 import"
```

---

## Task 2: Create D1 Schema and Import Script

**Files:**
- Create: `packages/web/schema.sql`
- Create: `packages/web/import.ts`
- Create: `packages/web/package.json`

**Interfaces:**
- Consumes: Export JSON files from Task 1
- Produces: D1 database with chunks, vectors, symbols tables

- [ ] **Step 1: Create D1 schema**

```sql
-- packages/web/schema.sql

CREATE TABLE IF NOT EXISTS chunks (
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

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
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
  embedding BLOB NOT NULL,
  FOREIGN KEY (chunk_id) REFERENCES chunks(id)
);

CREATE TABLE IF NOT EXISTS embedding_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_repo_path ON chunks(repository_id, relative_path);
CREATE INDEX IF NOT EXISTS idx_chunks_language ON chunks(language);
CREATE INDEX IF NOT EXISTS idx_chunks_heading ON chunks(heading_path);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(repository_id, name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(repository_id, symbol_kind, name);
CREATE INDEX IF NOT EXISTS idx_symbols_chunk ON symbols(chunk_id);
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/schema.sql
git commit -m "feat(web): add D1 schema"
```

- [ ] **Step 3: Create import script**

```typescript
// packages/web/import.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ExportedChunk, ExportedVector, ExportedSymbol, ExportMeta } from '@sce/core';

interface ImportOptions {
  dbCommand: (sql: string) => Promise<void>;
  exportDir: string;
}

const CHUNK_BATCH_SIZE = 50;
const VECTOR_BATCH_SIZE = 10;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function escapeString(s: string): string {
  return s.replace(/'/g, "''");
}

export async function importToD1(options: ImportOptions): Promise<void> {
  const { dbCommand, exportDir } = options;

  // Read export files
  const chunks: ExportedChunk[] = JSON.parse(
    readFileSync(resolve(exportDir, 'chunks.json'), 'utf-8')
  );
  const vectors: ExportedVector[] = JSON.parse(
    readFileSync(resolve(exportDir, 'vectors.json'), 'utf-8')
  );
  const symbols: ExportedSymbol[] = JSON.parse(
    readFileSync(resolve(exportDir, 'symbols.json'), 'utf-8')
  );
  const meta: ExportMeta = JSON.parse(
    readFileSync(resolve(exportDir, 'meta.json'), 'utf-8')
  );

  console.log(`Importing: ${chunks.length} chunks, ${vectors.length} vectors, ${symbols.length} symbols`);

  // Clear existing data
  await dbCommand('DELETE FROM symbols');
  await dbCommand('DELETE FROM vectors');
  await dbCommand('DELETE FROM chunks');
  await dbCommand('DELETE FROM embedding_config');

  // Import chunks in batches
  const chunkBatches = chunkArray(chunks, CHUNK_BATCH_SIZE);
  for (let i = 0; i < chunkBatches.length; i++) {
    const batch = chunkBatches[i];
    const values = batch.map(c =>
      `('${c.id}', '${c.repositoryId}', '${escapeString(c.relativePath)}', ${c.language ? `'${c.language}'` : 'NULL'}, ${c.headingPath ? `'${escapeString(c.headingPath)}'` : 'NULL'}, ${c.startLine}, ${c.endLine}, '${escapeString(c.text)}')`
    ).join(', ');
    await dbCommand(`INSERT OR REPLACE INTO chunks (id, repository_id, relative_path, language, heading_path, start_line, end_line, text) VALUES ${values}`);
    console.log(`  Chunks: ${Math.min((i + 1) * CHUNK_BATCH_SIZE, chunks.length)}/${chunks.length}`);
  }

  // Import vectors in batches
  const vectorBatches = chunkArray(vectors, VECTOR_BATCH_SIZE);
  for (let i = 0; i < vectorBatches.length; i++) {
    const batch = vectorBatches[i];
    const values = batch.map(v => {
      const embeddingJson = JSON.stringify(v.embedding);
      return `('${v.chunkId}', '${escapeString(embeddingJson)}')`;
    }).join(', ');
    await dbCommand(`INSERT OR REPLACE INTO vectors (chunk_id, embedding) VALUES ${values}`);
    console.log(`  Vectors: ${Math.min((i + 1) * VECTOR_BATCH_SIZE, vectors.length)}/${vectors.length}`);
  }

  // Import symbols
  if (symbols.length > 0) {
    const symbolValues = symbols.map(s =>
      `('${s.id}', '${s.chunkId}', '${escapeString(s.name)}', ${s.qualifiedName ? `'${escapeString(s.qualifiedName)}'` : 'NULL'}, ${s.symbolKind ? `'${s.symbolKind}'` : 'NULL'}, '${escapeString(s.relativePath)}', '${s.repositoryId}')`
    ).join(', ');
    await dbCommand(`INSERT OR REPLACE INTO symbols (id, chunk_id, name, qualified_name, symbol_kind, relative_path, repository_id) VALUES ${symbolValues}`);
  }

  // Store embedding config
  await dbCommand(`INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('model', '${meta.embeddingModel}')`);
  await dbCommand(`INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('dimensions', '${meta.embeddingDimensions}')`);
  await dbCommand(`INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('exported_at', '${meta.exportedAt}')`);

  console.log('Import complete');
}
```

- [ ] **Step 4: Create wrangler.toml**

```toml
# packages/web/worker/wrangler.toml
name = "sce-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "sce-db"
database_id = "TODO_CREATE_AND_FILL"  # Replace after `wrangler d1 create sce-db`
```

- [ ] **Step 5: Create package.json**

```json
{
  "name": "@sce/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:create": "wrangler d1 create sce-db",
    "db:schema": "wrangler d1 execute sce-db --file=schema.sql",
    "db:import": "tsx import.ts"
  },
  "devDependencies": {
    "wrangler": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/
git commit -m "feat(web): add D1 schema and import script"
```

---

## Task 3: Create Cloudflare Worker with Search API

**Files:**
- Create: `packages/web/worker/src/index.ts`
- Create: `packages/web/worker/src/search.ts`
- Create: `packages/web/worker/src/d1.ts`
- Create: `packages/web/worker/src/embedding.ts`
- Create: `packages/web/worker/src/cosine.ts`

**Interfaces:**
- Consumes: D1 database with chunks, vectors, symbols
- Produces: JSON API responses for /api/search and /api/stats

- [ ] **Step 1: Create cosine similarity helper**

```typescript
// packages/web/worker/src/cosine.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
```

- [ ] **Step 2: Create D1 helpers**

```typescript
// packages/web/worker/src/d1.ts
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
  id: string;
  chunk_id: string;
  name: string;
  qualified_name: string | null;
  symbol_kind: string | null;
  relative_path: string;
  repository_id: string;
}

export interface D1Vector {
  chunk_id: string;
  embedding: string; // JSON array
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

export function buildFilterClause(filters: SearchFilters, params: any[]): string {
  const conditions: string[] = [];

  if (filters.repositoryIds && filters.repositoryIds.length > 0) {
    const placeholders = filters.repositoryIds.map(() => '?').join(', ');
    conditions.push(`repository_id IN (${placeholders})`);
    params.push(...filters.repositoryIds);
  }

  if (filters.pathFilter) {
    conditions.push('relative_path LIKE ?');
    params.push(`%${filters.pathFilter}%`);
  }

  if (filters.language) {
    conditions.push('language = ?');
    params.push(filters.language);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/worker/src/cosine.ts packages/web/worker/src/d1.ts
git commit -m "feat(worker): add cosine similarity and D1 helpers"
```

- [ ] **Step 4: Create OpenRouter embedding client**

```typescript
// packages/web/worker/src/embedding.ts
export interface EmbeddingEnv {
  OPENROUTER_API_KEY: string;
}

export async function embedQuery(
  env: EmbeddingEnv,
  query: string,
  dimensions: number = 2048
): Promise<number[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
      input: query,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/worker/src/embedding.ts
git commit -m "feat(worker): add OpenRouter embedding client"
```

- [ ] **Step 6: Create search implementation**

```typescript
// packages/web/worker/src/search.ts
import { D1Database } from '@cloudflare/workers-types';
import { cosineSimilarity } from './cosine';
import { embedQuery, EmbeddingEnv } from './embedding';
import { D1Chunk, D1Symbol, SearchFilters, buildFilterClause } from './d1';

export type SearchMode = 'keyword' | 'semantic' | 'hybrid' | 'ast';

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

async function keywordSearch(
  db: D1Database,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  const params: any[] = [];
  const filterClause = buildFilterClause(filters || {}, params);

  // Simple LIKE search for keyword mode
  const sql = `
    SELECT id, relative_path, heading_path, text, language, 1.0 as score
    FROM chunks
    ${filterClause}
    AND (text LIKE ? OR relative_path LIKE ? OR heading_path LIKE ?)
    ORDER BY score DESC
    LIMIT ?
  `;

  const searchParam = `%${query}%`;
  params.push(searchParam, searchParam, searchParam, limit);

  const results = await db.prepare(sql).bind(...params).all();

  return results.map(row => ({
    chunkId: row.id as string,
    relativePath: row.relative_path as string,
    headingPath: row.heading_path as string | null,
    text: (row.text as string).substring(0, 500),
    score: row.score as number,
    language: row.language as string | null,
  }));
}

async function semanticSearch(
  db: D1Database,
  env: EmbeddingEnv,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  // Embed the query
  const queryEmbedding = await embedQuery(env, query);

  // Load vectors (with pre-filtering if possible)
  const params: any[] = [];
  const filterClause = buildFilterClause(filters || {}, params);

  let sql: string;
  let allParams: any[];

  if (filterClause) {
    // Pre-filter by joining with chunks
    sql = `
      SELECT v.chunk_id, v.embedding
      FROM vectors v
      JOIN chunks c ON v.chunk_id = c.id
      ${filterClause}
    `;
    allParams = params;
  } else {
    sql = 'SELECT chunk_id, embedding FROM vectors';
    allParams = [];
  }

  const vectorRows = await db.prepare(sql).bind(...allParams).all();

  // Compute similarities
  const similarities = vectorRows.map(row => {
    const embedding = JSON.parse(row.embedding as string) as number[];
    const score = cosineSimilarity(queryEmbedding, embedding);
    return { chunkId: row.chunk_id as string, score };
  });

  // Sort by score descending
  similarities.sort((a, b) => b.score - a.score);

  // Take top-k
  const topK = similarities.slice(0, limit);

  // Fetch chunk details
  const hits: SearchHit[] = [];
  for (const sim of topK) {
    const chunk = await db.prepare(
      'SELECT id, relative_path, heading_path, text, language FROM chunks WHERE id = ?'
    ).bind(sim.chunkId).first();

    if (chunk) {
      hits.push({
        chunkId: chunk.id as string,
        relativePath: chunk.relative_path as string,
        headingPath: chunk.heading_path as string | null,
        text: (chunk.text as string).substring(0, 500),
        score: sim.score,
        language: chunk.language as string | null,
      });
    }
  }

  return hits;
}

async function astSearch(
  db: D1Database,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchHit[]> {
  const params: any[] = [];

  // Build filter conditions for symbols
  const symbolConditions: string[] = [];
  if (filters?.repositoryIds && filters.repositoryIds.length > 0) {
    const placeholders = filters.repositoryIds.map(() => '?').join(', ');
    symbolConditions.push(`s.repository_id IN (${placeholders})`);
    params.push(...filters.repositoryIds);
  }
  if (filters?.pathFilter) {
    symbolConditions.push('s.relative_path LIKE ?');
    params.push(`%${filters.pathFilter}%`);
  }
  if (filters?.symbolKind) {
    symbolConditions.push('s.symbol_kind = ?');
    params.push(filters.symbolKind);
  }

  const whereClause = symbolConditions.length > 0
    ? `AND ${symbolConditions.join(' AND ')}`
    : '';

  // Tiered search: exact first, then prefix
  let sql = `
    SELECT s.id, s.name, s.qualified_name, s.symbol_kind, s.relative_path,
           c.id as chunk_id, c.heading_path, c.text, c.language,
           1.0 as score
    FROM symbols s
    JOIN chunks c ON s.chunk_id = c.id
    WHERE s.name = ? ${whereClause}
    LIMIT ?
  `;

  let results = await db.prepare(sql).bind(query, limit).all();

  // If no exact matches, try prefix
  if (results.length === 0) {
    sql = `
      SELECT s.id, s.name, s.qualified_name, s.symbol_kind, s.relative_path,
             c.id as chunk_id, c.heading_path, c.text, c.language,
             0.5 + (0.5 * LENGTH(?) / LENGTH(s.name)) as score
      FROM symbols s
      JOIN chunks c ON s.chunk_id = c.id
      WHERE s.name LIKE ? || '%' ${whereClause}
      ORDER BY LENGTH(s.name) ASC
      LIMIT ?
    `;
    results = await db.prepare(sql).bind(query, query, limit).all();
  }

  return results.map(row => ({
    chunkId: row.chunk_id as string,
    relativePath: row.relative_path as string,
    headingPath: row.heading_path as string | null,
    text: (row.text as string).substring(0, 500),
    score: row.score as number,
    language: row.language as string | null,
    symbolKind: row.symbol_kind as string | null,
  }));
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
    case 'keyword':
      hits = await keywordSearch(db, query, limit, filters);
      break;
    case 'semantic':
      hits = await semanticSearch(db, env, query, limit, filters);
      break;
    case 'hybrid': {
      // Run both, fuse with RRF
      const [keywordHits, semanticHits] = await Promise.all([
        keywordSearch(db, query, limit * 2, filters),
        semanticSearch(db, env, query, limit * 2, filters),
      ]);

      const k = 60; // RRF constant
      const scores = new Map<string, number>();

      keywordHits.forEach((hit, rank) => {
        const current = scores.get(hit.chunkId) || 0;
        scores.set(hit.chunkId, current + 1 / (k + rank + 1));
      });

      semanticHits.forEach((hit, rank) => {
        const current = scores.get(hit.chunkId) || 0;
        scores.set(hit.chunkId, current + 1 / (k + rank + 1));
      });

      // Sort by RRF score
      const sorted = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Fetch details
      const allHits = new Map<string, SearchHit>();
      for (const hit of [...keywordHits, ...semanticHits]) {
        allHits.set(hit.chunkId, hit);
      }

      hits = sorted.map(([chunkId, score]) => ({
        ...allHits.get(chunkId)!,
        score,
      }));
      break;
    }
    case 'ast':
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
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/worker/src/search.ts
git commit -m "feat(worker): implement search with keyword, semantic, hybrid, AST"
```

- [ ] **Step 8: Create Worker entry point**

```typescript
// packages/web/worker/src/index.ts
import { D1Database } from '@cloudflare/workers-types';
import { search, SearchMode } from './search';

interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
}

interface SearchParams {
  q: string;
  mode?: string;
  limit?: string;
  repositoryIds?: string;
  pathFilter?: string;
  language?: string;
  symbolKind?: string;
}

function parseSearchParams(url: URL): SearchParams {
  return {
    q: url.searchParams.get('q') || '',
    mode: url.searchParams.get('mode') || 'keyword',
    limit: url.searchParams.get('limit') || '20',
    repositoryIds: url.searchParams.get('repositoryIds') || undefined,
    pathFilter: url.searchParams.get('pathFilter') || undefined,
    language: url.searchParams.get('language') || undefined,
    symbolKind: url.searchParams.get('symbolKind') || undefined,
  };
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // API routes
    if (url.pathname === '/api/search') {
      const params = parseSearchParams(url);

      if (!params.q) {
        return new Response(
          JSON.stringify({ error: 'Query parameter "q" is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      }

      const validModes: SearchMode[] = ['keyword', 'semantic', 'hybrid', 'ast'];
      const mode = (params.mode || 'keyword') as SearchMode;

      if (!validModes.includes(mode)) {
        return new Response(
          JSON.stringify({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      }

      const filters = {
        repositoryIds: params.repositoryIds ? params.repositoryIds.split(',') : undefined,
        pathFilter: params.pathFilter,
        language: params.language,
        symbolKind: params.symbolKind,
      };

      try {
        const result = await search(
          env.DB,
          env,
          params.q,
          mode,
          parseInt(params.limit || '20'),
          filters
        );

        return new Response(
          JSON.stringify(result),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      } catch (error) {
        console.error('Search error:', error);
        return new Response(
          JSON.stringify({ error: 'Search failed', message: (error as Error).message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      }
    }

    if (url.pathname === '/api/stats') {
      try {
        const chunkCount = await env.DB.prepare('SELECT COUNT(*) as count FROM chunks').first();
        const vectorCount = await env.DB.prepare('SELECT COUNT(*) as count FROM vectors').first();
        const symbolCount = await env.DB.prepare('SELECT COUNT(*) as count FROM symbols').first();
        const model = await env.DB.prepare("SELECT value FROM embedding_config WHERE key = 'model'").first();

        return new Response(
          JSON.stringify({
            chunks: chunkCount?.count || 0,
            vectors: vectorCount?.count || 0,
            symbols: symbolCount?.count || 0,
            embeddingModel: model?.value || 'unknown',
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch stats' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

- [ ] **Step 9: Commit**

```bash
git add packages/web/worker/src/index.ts
git commit -m "feat(worker): add entry point with /api/search and /api/stats"
```

---

## Task 4: Create Frontend

**Files:**
- Create: `packages/web/frontend/index.html`
- Create: `packages/web/frontend/style.css`
- Create: `packages/web/frontend/app.js`

**Interfaces:**
- Consumes: Worker API endpoints
- Produces: Interactive search UI

- [ ] **Step 1: Create HTML**

```html
<!-- packages/web/frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SCE — Semantic Context Engine</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>SCE</h1>
      <p class="subtitle">Semantic Context Engine</p>
    </header>

    <main>
      <div class="search-box">
        <input
          type="text"
          id="query"
          placeholder="Search query..."
          autocomplete="off"
        >
        <button id="search-btn">Search</button>
      </div>

      <div class="mode-selector">
        <button class="mode active" data-mode="keyword">Keyword</button>
        <button class="mode" data-mode="semantic">Semantic</button>
        <button class="mode" data-mode="hybrid">Hybrid</button>
        <button class="mode" data-mode="ast">AST</button>
      </div>

      <div id="results" class="results"></div>

      <div id="stats" class="stats"></div>
    </main>

    <footer>
      <p>Search powered by SCE</p>
    </footer>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create CSS**

```css
/* packages/web/frontend/style.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
  line-height: 1.6;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1a1a1a;
}

.subtitle {
  color: #666;
  font-size: 1rem;
}

.search-box {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-box input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.search-box input:focus {
  border-color: #4a90d9;
}

.search-box button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.search-box button:hover {
  background: #357abd;
}

.mode-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.mode {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: #e0e0e0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode:hover {
  background: #d0d0d0;
}

.mode.active {
  background: #4a90d9;
  color: white;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-card {
  background: white;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.result-path {
  font-size: 0.875rem;
  color: #4a90d9;
  font-weight: 500;
}

.result-score {
  font-size: 0.75rem;
  color: #888;
  background: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.result-heading {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.result-text {
  font-size: 0.9rem;
  color: #444;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-meta {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #888;
}

.stats {
  margin-top: 2rem;
  padding: 1rem;
  background: #e8f4e8;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #2d5a2d;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  text-align: center;
  padding: 1rem;
  background: #fee;
  border-radius: 8px;
  color: #c00;
}

footer {
  margin-top: 3rem;
  text-align: center;
  color: #888;
  font-size: 0.875rem;
}
```

- [ ] **Step 3: Create JavaScript**

```javascript
// packages/web/frontend/app.js
const API_BASE = '';  // Same origin

let currentMode = 'keyword';
let searchTimeout = null;

// DOM elements
const queryInput = document.getElementById('query');
const searchBtn = document.getElementById('search-btn');
const resultsDiv = document.getElementById('results');
const statsDiv = document.getElementById('stats');
const modeButtons = document.querySelectorAll('.mode');

// Mode selection
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;

    // Re-search if there's a query
    if (queryInput.value.trim()) {
      performSearch();
    }
  });
});

// Search on Enter
queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// Search button click
searchBtn.addEventListener('click', performSearch);

// Debounced search as you type
queryInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (queryInput.value.trim().length >= 3) {
      performSearch();
    }
  }, 500);
});

async function performSearch() {
  const query = queryInput.value.trim();
  if (!query) {
    resultsDiv.innerHTML = '';
    return;
  }

  resultsDiv.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const params = new URLSearchParams({
      q: query,
      mode: currentMode,
      limit: '20',
    });

    const response = await fetch(`${API_BASE}/api/search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Search failed');
    }

    renderResults(data);
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

function renderResults(data) {
  if (data.hits.length === 0) {
    resultsDiv.innerHTML = '<div class="loading">No results found</div>';
    return;
  }

  const html = data.hits.map(hit => `
    <div class="result-card">
      <div class="result-header">
        <span class="result-path">${escapeHtml(hit.relativePath)}</span>
        <span class="result-score">${hit.score.toFixed(3)}</span>
      </div>
      ${hit.headingPath ? `<div class="result-heading">${escapeHtml(hit.headingPath)}</div>` : ''}
      <div class="result-text">${escapeHtml(hit.text)}</div>
      <div class="result-meta">
        ${hit.language ? `<span>${escapeHtml(hit.language)}</span>` : ''}
        ${hit.symbolKind ? `<span>${escapeHtml(hit.symbolKind)}</span>` : ''}
      </div>
    </div>
  `).join('');

  resultsDiv.innerHTML = html;

  // Update stats
  statsDiv.textContent = `${data.totalHits} results | ${data.searchTimeMs}ms | Mode: ${data.mode}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load stats on page load
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const data = await response.json();
    statsDiv.textContent = `${data.chunks} chunks indexed | ${data.symbols} symbols | Model: ${data.embeddingModel}`;
  } catch (error) {
    statsDiv.textContent = 'Stats unavailable';
  }
}

loadStats();
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/frontend/
git commit -m "feat(frontend): add search UI"
```

---

## Task 5: Deploy to Cloudflare

**Files:**
- Modify: `packages/web/worker/wrangler.toml` (add D1 binding)

**Interfaces:**
- Consumes: Wrangler CLI, Cloudflare account
- Produces: Live Worker + D1 database

- [ ] **Step 1: Create D1 database**

```bash
cd packages/web
wrangler d1 create sce-db
```

Copy the database_id from output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sce-db"
database_id = "YOUR_DATABASE_ID"
```

- [ ] **Step 2: Apply schema**

```bash
wrangler d1 execute sce-db --remote --file=schema.sql
```

- [ ] **Step 3: Import data**

```bash
# First, run export locally
cd ../../packages/cli
npx sce export -o ../../sce-export

# Then import to D1
cd ../web
wrangler d1 execute sce-db --remote --command="DELETE FROM chunks; DELETE FROM vectors; DELETE FROM symbols;"

# Import chunks
cat ../../sce-export/chunks.json | python -c "
import sys, json
chunks = json.load(sys.stdin)
for i in range(0, len(chunks), 50):
    batch = chunks[i:i+50]
    values = ', '.join([f\"('{c['id']}', '{c['repositoryId']}', '{c['relativePath'].replace(chr(39), chr(39)+chr(39))}', '{c.get('language', '')}', '{c.get('headingPath', '')}', {c['startLine']}, {c['endLine']}, '{c['text'][:1000].replace(chr(39), chr(39)+chr(39))}')\" for c in batch])
    print(f\"INSERT OR REPLACE INTO chunks (id, repository_id, relative_path, language, heading_path, start_line, end_line, text) VALUES {values};\")
" | wrangler d1 execute sce-db --remote
```

(For the demo, we'll create a proper import script if the above is too complex.)

- [ ] **Step 4: Set Worker secrets**

```bash
wrangler secret put OPENROUTER_API_KEY
# Paste: REDACTED_API_KEY
```

- [ ] **Step 5: Deploy Worker**

```bash
cd packages/web/worker
wrangler deploy
```

- [ ] **Step 6: Deploy Frontend**

```bash
cd packages/web
wrangler pages deploy frontend --project-name=sce-frontend
```

- [ ] **Step 7: Test deployment**

```bash
# Test search endpoint
curl "https://sce-worker.YOUR_SUBDOMAIN.workers.dev/api/search?q=test&mode=keyword"

# Test stats endpoint
curl "https://sce-worker.YOUR_SUBDOMAIN.workers.dev/api/stats"
```

- [ ] **Step 8: Commit**

```bash
git add packages/web/worker/wrangler.toml
git commit -m "chore(web): update wrangler.toml with D1 binding"
```

---

## Task 6: Index Atlassian Documentation

**Files:**
- Create: `packages/web/scripts/scrape-atlassian.ts`

**Interfaces:**
- Consumes: Atlassian public docs
- Produces: Markdown files for indexing

- [ ] **Step 1: Research Atlassian content sources**

Check:
- https://developer.atlassian.com/ (developer docs)
- https://support.atlassian.com/ (help center)
- https://www.atlassian.com/software/confluence/guides (guides)

Determine best source for markdown-convertible content.

- [ ] **Step 2: Create scraper (if needed)**

```typescript
// packages/web/scripts/scrape-atlassian.ts
// This is a placeholder - actual implementation depends on content source
```

- [ ] **Step 3: Index Atlassian docs locally**

```bash
# Update sce.config.json to include Atlassian docs
# Then run indexing
npx sce index
```

- [ ] **Step 4: Export and re-import**

```bash
npx sce export -o ../../sce-export
# Then re-import to D1
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/scripts/
git commit -m "feat(web): add Atlassian doc scraper"
```

---

## Task 7: Polish and Verify

**Files:**
- Modify: Various (bug fixes, polish)

**Interfaces:**
- Consumes: Deployed Worker + Frontend
- Produces: Production-ready demo

- [ ] **Step 1: Test all search modes**

- [ ] **Step 2: Verify response times**

- [ ] **Step 3: Check D1 usage against free tier**

- [ ] **Step 4: Add README for demo**

- [ ] **Step 5: Final commit**

```bash
git commit -m "feat(web): polish demo for deployment"
```

---

## Execution Notes

**Recommended execution order:**
1. Task 1 (Export) — can be done locally, validates the pipeline
2. Task 2 (Schema + Import) — prepares D1
3. Task 3 (Worker) — core API
4. Task 4 (Frontend) — UI
5. Task 5 (Deploy) — goes live
6. Task 6 (Atlassian content) — real data
7. Task 7 (Polish) — final touches

**Estimated time:** 4-6 hours for Tasks 1-5 (working demo), 2-3 hours for Tasks 6-7 (real content + polish).
