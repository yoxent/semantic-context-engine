# Semantic Context Engine

Local-first retrieval for AI coding agents. SCE indexes a Markdown knowledge vault (or later a code repo), then returns concise keyword hits through a shared core API exposed as CLI and MCP.

SCE is **not** a vector database. Keyword search ships in v1; semantic/AST/hybrid stay behind interfaces.

## Status

Current branch target: `develop` (implementation). `main` is reserved for production releases.

First vertical (shipped on `develop`):

- TypeScript npm workspaces monorepo (`@sce/*`)
- Vault indexing (Markdown headings + `[[wiki-links]]`)
- SQLite FTS5 keyword search under `.sce/metadata.sqlite`
- Shared composition via `@sce/runtime`
- Thin **CLI** and **MCP** adapters
- Structured logging (`logging.level` / CLI `--verbose`)
- Index `statistics()` via `sce stats` / `sce_stats`

## Requirements

- Node.js 20+

## Setup

```bash
npm install
npm run build
npm test
```

## CLI

```bash
# Index a vault (creates <path>/.sce/metadata.sqlite)
node packages/cli/dist/src/main.js index ./fixtures/sample-vault --type vault

# Search
node packages/cli/dist/src/main.js search "SQLite FTS5" --path ./fixtures/sample-vault
node packages/cli/dist/src/main.js search "SQLite FTS5" --path ./fixtures/sample-vault --json
node packages/cli/dist/src/main.js search "SQLite FTS5" --path ./fixtures/sample-vault --path-filter "*.md" --language markdown

# Fetch a full chunk by id
node packages/cli/dist/src/main.js chunk <chunk-id> --path ./fixtures/sample-vault

# Index statistics
node packages/cli/dist/src/main.js stats ./fixtures/sample-vault
node packages/cli/dist/src/main.js stats ./fixtures/sample-vault --json

# Refresh after edits
node packages/cli/dist/src/main.js update ./fixtures/sample-vault

# Structured JSON logs on stderr (also raised by logging.level=debug in sce.config.json)
node packages/cli/dist/src/main.js --verbose index ./fixtures/sample-vault --type vault
```

After `npm link` / packaging, the bin name is `sce`.

## MCP tools

Server entry: `packages/mcp/dist/src/server.js`

| Tool | Purpose |
|---|---|
| `sce_index_repository` | Index a vault/repo path |
| `sce_update_repository` | Incremental refresh (incl. deleted-file prune) |
| `sce_search` | Keyword search (`limit`, `includeText`, `pathFilter`, `language`, `repositoryIds`) |
| `sce_get_chunk` | Fetch chunk text (`maxChars` optional) |
| `sce_stats` | Index statistics (files, chunks, links, last indexed) |

## Config

Optional `sce.config.json` in the indexed root:

```json
{
  "indexing": {
    "include": ["**/*.md"],
    "ignore": ["private/**"]
  },
  "search": {
    "defaultLimit": 10,
    "maxSnippetChars": 500
  },
  "logging": {
    "level": "info"
  }
}
```

Defaults always keep ignores such as `.git/**`, `.sce/**`, and `node_modules/**`. Runtime loads this file through `@sce/runtime` → `loadConfig`.

`logging.level` controls structured JSON logs on stderr (`silent` | `error` | `warn` | `info` | `debug`). CLI `--verbose` raises the effective level to at least `debug`. Command results stay on stdout.

## Search filters

`SearchQuery` filters are applied by the keyword index:

| Field | Behavior |
|---|---|
| `repositoryIds` | Restrict to listed repository ids |
| `pathFilter` | Exact path, directory prefix (`notes` → `notes` and `notes/...`), or SQL GLOB (`*.md`, `notes/*`) |
| `language` | Exact language match (e.g. `markdown`) |

## Semantic search (opt-in)

Keyword search remains the default. Enable semantic (embedding-based) search by adding an `embedding` block to `sce.config.json`:

```json
{
  "embedding": {
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:11434/v1",
    "model": "nomic-embed-text",
    "dimensions": 768,
    "batchSize": 32,
    "apiKeyEnv": "OPENAI_API_KEY"
  }
}
```

- `provider` is currently `"openai-compatible"` only (local Ollama / LM Studio compatible).
- `apiKeyEnv` is the **name** of an environment variable holding a bearer token; the token itself is never stored in the config.
- Vectors are stored in the existing `.sce/metadata.sqlite` behind `IVectorStore`.
- Embeddings are generated during `index`/`update`, not lazily during search.
- Changing `model` or `dimensions` is a rebuild boundary: re-indexing fails with a clear rebuild instruction rather than mixing vectors.
- If the embedding server is unreachable during `index`/`update`, indexing fails hard with a clear error.

Request semantic mode explicitly:

```bash
sce search "vector retrieval" --path ./fixtures/sample-vault --mode semantic
```

MCP `sce_search` accepts `mode: "semantic"`.

Semantic mode honors `repositoryIds`. `pathFilter` and `language` remain keyword-only and throw a clear unsupported-filter error when used with `--mode semantic`.

### Future work

The future goal is a separate `.sce/semantic/` layout (`embeddings.bin`, `vector.index`) behind the same `IVectorStore` interface, plus hybrid, AST, ANN indexing, and cloud-only providers as later slices.

## Packages

| Package | Role |
|---|---|
| `@sce/core` | Public API, models, interfaces, config, logging |
| `@sce/indexing` | Discovery, ignore rules, index/update |
| `@sce/parsing` | Markdown chunking + wiki-links |
| `@sce/storage` | SQLite metadata + FTS |
| `@sce/ranking` | Simple keyword ranker |
| `@sce/retrieval` | Keyword strategy |
| `@sce/runtime` | Composition (`createEngine`) |
| `@sce/cli` / `@sce/mcp` | Adapters |
| `@sce/embedding` | `OpenAICompatibleEmbeddingProvider` (HTTP embeddings) |

## Docs

- `GOAL.md` — long-term product vision
- `docs/superpowers/specs/2026-07-12-sce-interface-first-vertical-design.md` — approved first-slice design
- `docs/superpowers/plans/2026-07-12-sce-interface-first-vertical.md` — implementation plan used to build v1

## Explicit non-goals (v1)

- Binary vector layout / ANN index
- Hybrid / AST search
- Cloud-only embedding providers
- Public Obsidian-like web UI
- Pasttime coupling
