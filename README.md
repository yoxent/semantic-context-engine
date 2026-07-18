# Semantic Context Engine

**Personal coding knowledgebase for my projects.** SCE indexes the docs and code I actually use, then feeds AI agents (CLI / MCP / web) so they pull *my* stack and patterns instead of guessing from stale training data.

It is built for **my** active work — not as a general public product:

| Project | Why it’s in the corpus |
|---|---|
| **semantic-context-engine** (this repo) | Workers, D1, embeddings, MCP, CLI patterns |
| **word-guess** | Expo, Firebase, IAP / AdMob, Maestro, RN |
| **web-portfolio** | Next.js, Tailwind, Resend, Vercel |

Third-party docs (Expo, Firebase, Hono, Drizzle, Cloudflare, etc.) sit alongside **own-repo corpora** so agents can reuse both official APIs and how *I* wire them.

**License:** proprietary — all rights reserved. This repo and its knowledgebase are for my own projects; not offered as open-source software.

### Live

| | |
|---|---|
| Web | https://sce-web.pasttime.xyz/ |
| API | https://sce-api.pasttime.xyz |
| Inventory | `knowledge/INVENTORY.md` (~1249 chunks / 1232 vectors in D1) |
| Search | `sce search "query"` |

Local-first by design: each indexed root keeps `.sce/metadata.sqlite`. Production search is also mirrored to Cloudflare D1 for the live API/UI.

## Status

Branch: `develop` (implementation). `main` is for production releases.

Shipped on `develop`:

- TypeScript npm workspaces monorepo (`@sce/*`)
- Markdown vault indexing + opt-in TypeScript/JavaScript AST chunking
- SQLite FTS5 keyword search under `.sce/metadata.sqlite`
- Opt-in semantic / hybrid search (OpenAI-compatible embeddings)
- AST symbol lookup
- Shared composition via `@sce/runtime`
- Thin **CLI** and **MCP** adapters + Cloudflare web/API worker
- Structured logging (`logging.level` / CLI `--verbose`)
- Index `statistics()` via `sce stats` / `sce_stats`
- Batch scripts to grow the knowledgebase (`scripts/index-*-batch.mjs`, `scripts/index-own-corpora.mjs`)

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
| `sce_search` | Keyword, semantic, hybrid, or AST search (`mode`, `symbolKind`, `limit`, `includeText`, `pathFilter`, `language`, `repositoryIds`) |
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

## Code indexing (opt-in)

SCE indexes Markdown by default. To index TypeScript/JavaScript code too, extend `indexing.include` in `sce.config.json`:

```json
{
  "indexing": {
    "include": ["**/*.md", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs", "**/*.mts", "**/*.cts"]
  }
}
```

Supported code languages and extensions:

| Language | Extensions | Chunked at |
|---|---|---|
| `typescript` | `.ts` `.tsx` `.mts` `.cts` | AST declaration nodes |
| `javascript` | `.js` `.jsx` `.mjs` `.cjs` | AST declaration nodes |

Code files are chunked at AST declaration nodes via `tree-sitter` (WASM). Each chunk carries a `symbolKind`:

`function` · `method` · `arrow` · `function-expr` · `class` · `interface` · `type` · `enum` · `namespace`

A `const`/`export const` binding an arrow function, function expression, or class expression is chunked under `arrow` / `function-expr` / `class` respectively (name taken from the binding). Plain data `const` declarations and unnamed declarations are not chunked. A code file with zero declarations (e.g. only `import`s) produces one whole-file chunk so it stays keyword-searchable.

Code with syntax errors is parsed best-effort: valid declarations are still chunked, and a debug log (`parse.hasError`) is emitted.

Markdown default behavior is unchanged: if `indexing.include` stays `["**/*.md"]`, no code files are indexed. Files whose extension maps to an unsupported language (e.g. `.json`, `.yaml`) are skipped. Semantic and hybrid search cover code chunks too when `embedding` is configured.

Call hierarchy, references, and inheritance are future slices.

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
- For this project, the OpenRouter key is in `packages/web/.dev.vars` (also stored as a Cloudflare secret).
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

The future goal is a separate `.sce/semantic/` layout (`embeddings.bin`, `vector.index`) behind the same `IVectorStore` interface, plus AST, ANN indexing, and cloud-only providers as later slices.

## AST symbol lookup

AST search finds code symbols by name, with an optional `symbolKind` filter. It is always available (no `embedding` config required) whenever code files are indexed.

```bash
sce search "Widget" --path ./repo --mode ast
sce search "render" --path ./repo --mode ast --symbol-kind method
```

MCP `sce_search` accepts `mode: "ast"` and `symbolKind`.

Behavior:

- **Tiered matching:** exact name match first (case-insensitive); if no exact match, prefix match (`rend` → `render`, `renderView`). Exact match scores `1.0`; prefix match scores `0.5 + (queryLength / nameLength)`.
- **`symbolKind` filter:** one of `function` · `method` · `arrow` · `function-expr` · `class` · `interface` · `type` · `enum` · `namespace`. Narrows both match tiers. Rejected with a clear error on `keyword`/`semantic`/`hybrid` modes.
- **Ranking:** within a tier, top-level symbols rank before nested ones (shorter qualified name), and prominent kinds (`class`/`interface`/`type`/`enum`/`namespace`) rank before functions, which rank before methods.
- **Filters honored:** `repositoryIds`, `pathFilter` (exact/prefix/GLOB, same as keyword), `language`. Unlike semantic/hybrid, AST accepts `pathFilter` and `language`.
- **Always wired:** no `embedding` block needed. On a Markdown-only vault (no code indexed), AST returns empty results — not an error.
- **Empty `text`** is rejected with a clear error.

## Hybrid search (opt-in)

Hybrid search runs the keyword and semantic strategies in parallel and fuses their ranked lists with **Reciprocal Rank Fusion** (`k = 60`). It is available whenever semantic search is enabled (i.e. when the `embedding` block is present in `sce.config.json`). There are no extra config keys.

Request hybrid mode explicitly:

```bash
sce search "how is inventory persisted" --path ./fixtures/sample-vault --mode hybrid
```

MCP `sce_search` accepts `mode: "hybrid"`.

Behavior:

- Each side over-fetches `max(limit * 2, 20)` candidates, RRF merges the two ranked lists, then results are cut to the requested `limit`.
- A chunk that appears on **both** sides gets a higher fused score than a chunk on one side — that boost is the hybrid signal.
- Each fused hit reports `strategy: "hybrid"` and a `score` equal to the fused RRF score. SCE does **not** re-rank fused hits with `SimpleRanker`; each side already ranked itself.
- Hybrid honors `repositoryIds` (forwarded to both sides). `pathFilter` and `language` remain keyword-only and throw a clear unsupported-filter error when used with `--mode hybrid`.
- If hybrid is requested without an `embedding` block, SCE throws `Hybrid search is not configured` rather than silently falling back to keyword.

## Packages

| Package | Role |
|---|---|
| `@sce/core` | Public API, models, interfaces, config, logging |
| `@sce/indexing` | Discovery, ignore rules, index/update |
| `@sce/parsing` | Markdown chunking, wiki-links, and tree-sitter TS/JS AST chunking |
| `@sce/storage` | SQLite metadata + FTS |
| `@sce/ranking` | Simple keyword ranker |
| `@sce/retrieval` | Keyword, semantic, hybrid, and AST retrieval strategies |
| `@sce/runtime` | Composition (`createEngine`) |
| `@sce/cli` / `@sce/mcp` | Adapters |
| `@sce/embedding` | `OpenAICompatibleEmbeddingProvider` (HTTP embeddings) |

## Docs

- `GOAL.md` — long-term product vision
- `knowledge/INVENTORY.md` — what’s indexed in D1 (docs + own repos)
- `docs/superpowers/specs/…` / `docs/superpowers/plans/…` — slice designs and implementation plans

## Explicit non-goals (for now)

- Binary ANN layout as a separate vector DB product
- AST call hierarchy / references / inheritance
- Multi-tenant / public SaaS knowledge hosting
- Being a drop-in replacement for a general-purpose vector database
