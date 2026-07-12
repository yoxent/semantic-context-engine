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

# Fetch a full chunk by id
node packages/cli/dist/src/main.js chunk <chunk-id> --path ./fixtures/sample-vault

# Refresh after edits
node packages/cli/dist/src/main.js update ./fixtures/sample-vault
```

After `npm link` / packaging, the bin name is `sce`.

## MCP tools

Server entry: `packages/mcp/dist/src/server.js`

| Tool | Purpose |
|---|---|
| `sce_index_repository` | Index a vault/repo path |
| `sce_update_repository` | Incremental refresh (incl. deleted-file prune) |
| `sce_search` | Keyword search (`limit`, `includeText`) |
| `sce_get_chunk` | Fetch chunk text (`maxChars` optional) |

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

## Packages

| Package | Role |
|---|---|
| `@sce/core` | Public API, models, interfaces, config |
| `@sce/indexing` | Discovery, ignore rules, index/update |
| `@sce/parsing` | Markdown chunking + wiki-links |
| `@sce/storage` | SQLite metadata + FTS |
| `@sce/ranking` | Simple keyword ranker |
| `@sce/retrieval` | Keyword strategy |
| `@sce/runtime` | Composition (`createEngine`) |
| `@sce/cli` / `@sce/mcp` | Adapters |
| `@sce/embedding` | Interface shell for later semantic search |

## Docs

- `GOAL.md` — long-term product vision
- `docs/superpowers/specs/2026-07-12-sce-interface-first-vertical-design.md` — approved first-slice design
- `docs/superpowers/plans/2026-07-12-sce-interface-first-vertical.md` — implementation plan used to build v1

## Explicit non-goals (v1)

- Embeddings / vector DB
- AST / hybrid search
- Public Obsidian-like web UI
- Pasttime coupling
