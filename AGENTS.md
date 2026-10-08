# Semantic Context Engine — Agent Guide

## Read First

1. `README.md` — Project overview, setup, CLI usage, package map
2. `HANDOFF.md` — Live state, deployment commands, known issues
3. `GOAL.md` — Full product vision and design principles
4. `knowledge/INVENTORY.md` — What's indexed in D1 (~1249 chunks)

## Architecture

TypeScript npm workspaces monorepo (`@sce/*`). Local-first: each indexed root keeps `.sce/metadata.sqlite`. Production search mirrored to Cloudflare D1.

### Packages

| Package | Path | Role |
|---------|------|------|
| `@sce/core` | `packages/core/` | Public API, models, interfaces, config, logging |
| `@sce/indexing` | `packages/indexing/` | Discovery, ignore rules, index/update |
| `@sce/parsing` | `packages/parsing/` | Markdown chunking, tree-sitter TS/JS AST chunking |
| `@sce/storage` | `packages/storage/` | SQLite metadata + FTS |
| `@sce/ranking` | `packages/ranking/` | Simple keyword ranker |
| `@sce/retrieval` | `packages/retrieval/` | Keyword, semantic, hybrid, AST retrieval strategies |
| `@sce/runtime` | `packages/runtime/` | Composition (`createEngine`) |
| `@sce/embedding` | `packages/embedding/` | `OpenAICompatibleEmbeddingProvider` |
| `@sce/cli` | `packages/cli/` | CLI adapter |
| `@sce/mcp` | `packages/mcp/` | MCP server adapter |

### Web / Cloudflare

| Worker | Path | Purpose |
|--------|------|---------|
| `sce-api` | `packages/web/worker/` | API (D1 + embedding search) |
| `sce-web` | `packages/web/` | Static frontend |

### Config

- `packages/sce.config.json` — Root config for own-repo indexing
- `knowledge/<topic>/sce.config.json` — Per-topic config for third-party docs
- `packages/web/worker/wrangler.toml` — API worker config (D1 binding, secrets)
- `packages/web/wrangler.jsonc` — Frontend worker config

## Adding New Documentation

1. Create URL list: `knowledge/urls/<topic>.txt`
2. Scrape: `npx tsx packages/web/cf-scraper.ts knowledge/urls/<topic>.txt ./knowledge/<topic>`
3. Create `knowledge/<topic>/sce.config.json` (see README for template)
4. Index: `export OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY packages/web/.dev.vars | cut -d'"' -f2) && node packages/cli/dist/src/main.js index .` (from `knowledge/<topic>/`)
5. Export: `node packages/cli/dist/src/main.js export -o knowledge/<topic>-export --path knowledge/<topic>`
6. Import: `npx tsx packages/web/import.ts knowledge/<topic>-export sce-db --append`

### Unity Documentation Sources

For Unity-related topics, always include official Unity 6000.3 docs:
- Manual: `https://docs.unity3d.com/6000.3/Documentation/Manual/<Page>.html`
- Scripting API: `https://docs.unity3d.com/6000.3/Documentation/ScriptReference/<Class>.html`
- Combine with Context7 content for practical examples

Batch helpers: `scripts/index-knowledge-batch.mjs`, `scripts/export-import-knowledge-batch.mjs`

## Search Modes

| Mode | Local (`@sce/retrieval`) | Hosted demo (`sce-api`) |
|------|--------------------------|-------------------------|
| `keyword` | FTS/SQL LIKE, word AND | D1 LIKE, stopwords stripped |
| `semantic` | Full corpus via `IVectorStore` | Lexical candidates (~24) → embed → cosine rerank |
| `hybrid` | Full keyword + full semantic, RRF k=60 | Same fusion; semantic leg is candidate-limited |
| `ast` | Symbol exact → prefix | Same (API/MCP; not in web UI) |

Demo limits exist for Cloudflare Workers **Free** tier (10ms CPU, D1 result memory). Local-first SCE has no shortlist cap.

Ranking on the worker: filename (+ up to 8) > heading (+ up to 7) > snippet (+ up to 4); max 2 hits per file. Web UI includes a collapsible glossary explaining modes and ranking.

## Deployment

```bash
# API Worker
cd packages/web/worker && npx wrangler deploy --config wrangler.toml

# Frontend
cd packages/web && npx wrangler deploy

# Import to D1
npx tsx packages/web/import.ts <export-dir> sce-db --append
```

## Branches

- `develop` — Active implementation
- `main` — Production releases
