# Handoff: Semantic Context Engine (SCE)

## Current state (2026-07-14)

First interface-first vertical, ops polish, ranking, the opt-in semantic search slice, the opt-in hybrid search slice, opt-in TS/JS code indexing (AST chunking), AST symbol lookup, and **web deployment** are implemented on **`develop`**.

- Branch: `develop` (tracks `origin/develop`)
- `main` is production-only — do not land feature work there yet

## Canonical docs

- `README.md` — how to run the shipped vertical
- `GOAL.md` — long-term vision (still ahead of v1)
- `docs/superpowers/specs/2026-07-14-sce-web-deployment-slice-design.md` — approved web deployment design
- `docs/superpowers/plans/2026-07-14-sce-web-deployment-slice.md` — web deployment implementation plan

## Locked product decisions

- SCE is the product; primary consumer = AI coding agents; secondary = human presentation later
- Pasttime is unrelated in code (DNS/subdomain borrowing only, later)
- Approach: interface-first thin vertical
- First agent surface: vault + CLI/MCP on one public API
- Human Obsidian-like UI later inside SCE, not Pasttime
- **Demo purpose:** Portfolio piece for AI Knowledge Systems Architect job at Remote CoWorker (BPO company)
- **Narrative:** "I built a semantic knowledge retrieval system. Here it is running over Atlassian's documentation — the same platform your teams use."

## Shipped in v1 (+ polish)

- Monorepo packages under `packages/`
- Core API + plugin interfaces
- Markdown vault indexing with heading chunks and wiki-link metadata
- SQLite FTS5 keyword search in `.sce/metadata.sqlite`
- Incremental update + deleted-file prune
- `sce.config.json` loaded at runtime
- CLI + MCP adapters sharing `@sce/runtime`
- Structured logging (`createLogger`, `logging.level`, CLI `--verbose`)
- `statistics()` / `sce stats` / `sce_stats`
- Keyword search honors `repositoryIds`, `pathFilter`, `language`

## Recently shipped (ranking slice)

- `SearchHit.headingPath` populated from SQLite
- `SimpleRanker` basename + heading-path + phrase/identifier boosts with stable tie-break

### Shipped (semantic slice, 2026-07-13)

- Opt-in `embedding` config block in `sce.config.json` (provider, baseUrl, model, dimensions, batchSize, apiKeyEnv)
- `@sce/embedding` `OpenAICompatibleEmbeddingProvider` (OpenAI-compatible HTTP embeddings)
- `@sce/storage` `SqliteVectorStore` — SQLite vectors stored behind `IVectorStore`
- `@sce/retrieval` `SemanticRetrievalStrategy` — embedding-based retrieval reusing `SimpleRanker`
- Indexing embeds changed chunks and prunes vectors; rebuild boundary on `model`/`dimensions` change (fails with clear instruction instead of mixing vectors)
- `@sce/runtime` wires semantic search when `embedding` config is present
- CLI `--mode semantic`; MCP `sce_search` `mode` field (`"keyword"` / `"semantic"`)
- Search filters `pathFilter` / `language` rejected with a clear unsupported-filter error when used with semantic mode (keyword-only); `repositoryIds` honored by semantic

### Shipped (hybrid slice, 2026-07-13)

- `@sce/retrieval` `HybridRetrievalStrategy` — runs keyword + semantic in parallel, fuses with Reciprocal Rank Fusion (`k = 60`)
- Over-fetch per side `max((limit ?? defaultLimit) * 2, 20)`, then cut to `limit`; `scannedChunks` reports unique chunk ids before the cut
- Fused hits carry `strategy: "hybrid"` and RRF score; no re-ranking after fuse
- `@sce/core` routes `search({ mode: "hybrid" })` / `hybridSearch()` to an injected `hybridStrategy`; clear `Hybrid search is not configured` error when embedding is missing
- `@sce/runtime` wires `HybridRetrievalStrategy` whenever the `embedding` block is present
- CLI `--mode hybrid`; MCP `sce_search` `mode: "hybrid"`
- Hybrid honors `repositoryIds`; rejects `pathFilter` / `language` with the same unsupported-filter errors as semantic
- No new `sce.config.json` keys; AST fusion, configurable RRF `k`, and post-filtering remain follow-ups

### Shipped (code indexing slice, 2026-07-13)

- `@sce/core` `Language` type, `SymbolKind` type, `detectLanguage(relativePath)` helper, and optional `Chunk.symbolKind`
- `@sce/parsing` `TreeSitterCodeChunker` — `web-tree-sitter` (WASM) with vendored TS/TSX/JS grammar `.wasm` files; AST cursor traversal chunks 9 declaration kinds (`function`, `method`, `arrow`, `function-expr`, `class`, `interface`, `type`, `enum`, `namespace`) + const-bound arrow/function-expr/class; skips unnamed + plain data `const`; whole-file fallback chunk for zero-declaration files; best-effort on syntax errors
- `@sce/parsing` `LanguageChunkerRegistry` — dispatches chunking by `input.language` (markdown/typescript/javascript); `IChunker` interface unchanged
- `@sce/indexing` uses `detectLanguage`; skips `text`-language files before read and cleans up any pre-existing record/chunks/FTS/vectors for them
- `@sce/runtime` builds the registry (markdown + TS + JS chunkers) and injects it as the single `chunker`
- Code chunks embed uniformly when `embedding` is configured; no new config keys; default `indexing.include` stays `["**/*.md"]` (code is opt-in)
- Keyword, semantic, and hybrid search now cover code chunks; Markdown behavior unchanged
- Follow-ups: call hierarchy, references, inheritance, JSON/YAML, second language family (Python/Go), overlapping-chunk dedup

### Shipped (AST symbol lookup slice, 2026-07-13)

- `@sce/core` `ISymbolIndex` interface, `SymbolSearchQuery`, `SymbolHit` (with `matchType: "exact" | "prefix"`), and optional `symbolKind` on `SearchQuery`/`SearchHit`
- `@sce/storage` `SqliteSymbolIndex` — tiered exact-then-prefix search over `symbols` table; SQL-level `repositoryIds`/`pathFilter`/`language`/`symbolKind` filters; ranking by `qualified_name` length + `symbol_kind_priority` + name + chunk_id
- `@sce/storage` `symbols` table — write-aside (no `chunks` migration); indexed by `(repository_id, name)`, `(repository_id, symbol_kind, name)`, `(repository_id, relative_path)`
- `@sce/storage` shared `pathFilter` helper — extracted from `SqliteStorage`, parameterized by column expression; both keyword and AST use it
- `@sce/retrieval` `AstRetrievalStrategy` — direct scoring from `matchType` (`exact` → 1.0, `prefix` → 0.5 + matchedLength/nameLength); no `SimpleRanker`; rejects empty `text` with clear error
- `@sce/retrieval` `symbolKind` rejection on keyword/semantic/hybrid modes — clear unsupported-filter error
- `@sce/core` routes `search({ mode: "ast" })` / `astSearch()` to injected `astStrategy`; clear `AST search is not configured` error when absent
- `@sce/indexing` writes/prunes symbols alongside chunks (after `indexChunks`, before embedding); `text`-skip path does NOT touch symbols
- `@sce/runtime` always wires `AstRetrievalStrategy` + `SqliteSymbolIndex` (no config gate)
- CLI `--mode ast` + `--symbol-kind`; MCP `sce_search` accepts `mode: "ast"` + `symbolKind`
- AST is always wired (no `embedding` gate); empty results on Markdown-only vaults (not an error)

### Shipped (web deployment slice, 2026-07-14)

- **Export command:** `sce export` CLI command exports chunks, vectors, symbols to JSON for D1 import
- **D1 schema:** `chunks`, `vectors` (TEXT for JSON), `symbols`, `embedding_config` tables with indexes
- **Cloudflare Worker API:** `/api/search` (keyword, semantic, hybrid, AST) and `/api/stats` endpoints
- **Frontend:** Static HTML/CSS/JS search UI with mode selector, debounced search, responsive design
- **Deployment:** Live at `sce-web.xent-xent.workers.dev` (frontend) and `sce-worker.xent-xent.workers.dev` (API)
- **OpenRouter embeddings:** `nvidia/llama-nemotron-embed-vl-1b-v2:free` (2048 dimensions, $0 cost)
- **Current state:** 1537 chunks, 27 vectors imported (semantic search works but limited)

## Configuration

### sce.config.json (root)

```json
{
  "embedding": {
    "provider": "openai-compatible",
    "baseUrl": "https://openrouter.ai/api/v1",
    "model": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    "dimensions": 2048,
    "batchSize": 5,
    "apiKeyEnv": "OPENROUTER_API_KEY"
  },
  "indexing": {
    "include": ["**/*.md"]
  }
}
```

### Environment variables

- `OPENROUTER_API_KEY` — OpenRouter API key for embeddings (free tier)
- Set in `.env` or export before running `sce index`

### Cloudflare resources

- **D1 Database:** `sce-db` (ID: `eca50171-09fe-48a7-be44-b20d85c6ed6c`)
- **Worker:** `sce-worker` (https://sce-worker.xent-xent.workers.dev)
- **Pages/Worker:** `sce-web` (https://sce-web.xent-xent.workers.dev)
- **Secrets:** `OPENROUTER_API_KEY` set on `sce-worker`

## Known issues / Tech debt

1. **Vector import is slow:** D1 import of 2048-dim vectors takes ~3 hours. Need batch optimization or alternative storage.
2. **Only 27 vectors imported:** Semantic search works but limited coverage.
3. **AST mode has no symbols:** Symbol import not implemented yet.
4. **Frontend hardcodes API URL:** `const API_BASE = 'https://sce-worker.xent-xent.workers.dev'` in `app.js`
5. **Import scripts were deleted:** Need to recreate clean import tooling.

## Next steps (from original plan)

### Immediate (Tasks 6-7 from plan)

1. **Index Atlassian documentation** — Research public Atlassian docs, scrape to markdown, index with embeddings
2. **Polish and verify** — Test all modes, verify response times, check D1 limits

### Follow-ups (from HANDOFF.md)

- AST call hierarchy, references, inheritance
- AST in hybrid (third RRF list)
- Binary vector layout / ANN index (`.sce/semantic/` layout)
- Cloud-only embedding providers
- Human UI on Cloudflare subdomain

### Job demo specific

- Deploy with real Atlassian content
- Create demo narrative for interview
- Add pipeline visualization to frontend
- Consider adding Notion integration for job relevance

## For the next agent

1. Read `README.md` and the design spec.
2. Work on `develop`, not `main`.
3. **Priority:** Import full vector set (1737 vectors) to D1 for complete semantic search.
4. **Then:** Index Atlassian documentation for the live demo.
5. Keep Pasttime untouched.

## Useful commands

```bash
# Index locally with embeddings
export OPENROUTER_API_KEY="sk-or-v1-..."
npx sce index .

# Export for D1
npx sce export -o ./sce-export

# Deploy to Cloudflare
cd packages/web/worker && npx wrangler deploy
cd packages/web && npx wrangler pages deploy frontend --project-name=sce-web

# Test API
curl "https://sce-worker.xent-xent.workers.dev/api/search?q=test&mode=keyword"
curl "https://sce-worker.xent-xent.workers.dev/api/stats"
```
