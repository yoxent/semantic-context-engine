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

Batch helpers: `scripts/index-knowledge-batch.mjs`, `scripts/export-import-knowledge-batch.mjs`

## Search Modes

- `keyword` — SQL LIKE over text/path/heading (~55ms)
- `semantic` — OpenRouter embedding → cosine similarity
- `hybrid` — RRF fusion of keyword + semantic (k=60)
- `ast` — Symbol table lookup (exact → prefix)

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
