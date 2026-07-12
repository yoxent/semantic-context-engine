# SCE Interface-First Vertical Design

Date: 2026-07-12

## Status

Approved through design discussion. This document describes the first implementation slice for Semantic Context Engine (SCE). It does not authorize scaffolding or implementation by itself; implementation should be planned separately with the writing-plans workflow.

## Product Intent

Semantic Context Engine is a local-first retrieval framework for AI coding agents. It is not a vector database; vector storage is one replaceable implementation detail inside a broader context retrieval layer.

The first slice ships one useful retrieval path for agents:

- A knowledge vault made of Markdown files is indexed as a normal repository type.
- Keyword search is the first implemented retrieval strategy.
- Local CLI and MCP adapters call the same public API.
- Semantic, AST, hybrid retrieval, embeddings, vector stores, and web UI are designed as extension points, not shipped behavior.

Pasttime remains unrelated as an application. SCE may later use the same Cloudflare account and apex domain for a hidden human UI subdomain, but SCE and Pasttime must not know each other exist in code.

## Package And Folder Structure

Use a TypeScript npm-workspaces monorepo. Keep the number of packages small: enough to preserve boundaries, not one package for every class.

```text
semantic-context-engine/
+-- packages/
|   +-- core/
|   |   +-- src/
|   |       +-- api/
|   |       +-- models/
|   |       +-- interfaces/
|   |       +-- config/
|   |       +-- logging/
|   |       +-- di/
|   +-- indexing/
|   +-- parsing/
|   +-- retrieval/
|   +-- storage/
|   +-- ranking/
|   +-- embedding/
|   +-- cli/
|   +-- mcp/
+-- fixtures/
|   +-- sample-vault/
+-- docs/
|   +-- superpowers/
|       +-- specs/
+-- package.json
+-- tsconfig.base.json
```

Package responsibilities:

- `core` owns public API contracts, shared models, interfaces, config types, logging abstractions, and dependency wiring types.
- `indexing` owns discovery, ignore-rule application, file hashing, index/update orchestration helpers, and incremental hooks.
- `parsing` owns Markdown parsing first, including heading sections and wiki-link extraction. Other parsers remain future plugins.
- `retrieval` owns retrieval strategies. V1 implements keyword retrieval; semantic, AST, and hybrid stay behind interfaces.
- `storage` owns local SQLite metadata and keyword index implementations.
- `ranking` owns scoring and result ordering.
- `embedding` owns embedding provider interfaces. No real embedding provider is required in v1.
- `cli` and `mcp` are thin adapters over `core`.

Dependency rule: adapters depend on `core`; implementations depend on `core` interfaces. Domain packages should not bypass public interfaces to reach into each other.

## Core Public API

The public API is what CLI and MCP call. It should be stable enough that later retrieval strategies do not force adapter rewrites.

- `indexRepository(opts)` performs a full index of a repository or vault root.
- `updateRepository(opts)` incrementally refreshes added, changed, and deleted files.
- `deleteRepository(id)` removes index and metadata for a repository.
- `search(query)` is the intent-routed entrypoint. In v1 it routes to keyword search.
- `keywordSearch(query)`, `semanticSearch(query)`, `astSearch(query)`, and `hybridSearch(query)` expose explicit modes. Only keyword search is implemented in v1.
- `getChunk(id)` fetches stored chunk context.
- `getFile(path)` assembles file-level context when needed.
- `statistics()` reports index state and timing counters.
- `optimize()` is an operational hook that can be minimal in v1.

## Core Data Model

Core models:

- `Repository`: `id`, `rootPath`, `type` (`code` or `vault`), `indexedAt`, optional `displayName`.
- `Chunk`: `id`, `repositoryId`, `relativePath`, `language`, `startLine`, `endLine`, `text`, `fileHash`, optional symbol fields, optional `headingPath`, optional `gitCommitHash`, `timestamp`.
- `SearchQuery`: `text`, optional `repositoryIds`, optional `mode`, `limit`, and filters such as path or language.
- `SearchHit`: `chunkId`, `score`, `strategy`, snippet, path, and line range.
- `SearchResult`: ordered `hits` and optional diagnostics such as strategy used and timings.

Markdown vault wiki-links are stored as metadata on chunks. They are not a separate graph database in v1.

## Core Interfaces

Primary plugin interfaces:

- `IRetrievalStrategy` exposes `name` and `search(query)`.
- `IChunker` converts parsed file content into chunks.
- `IMetadataStore` persists repositories, files, chunks, and link metadata.
- `IKeywordIndex` indexes and searches keyword text.
- `IEmbeddingProvider` defines provider-independent embedding generation.
- `IVectorStore` defines future vector persistence and lookup.
- `IRanker` scores, merges, and orders hits.

Interfaces live in `packages/core`. Implementations live in the domain packages.

## Storage

Use a local `.sce/` directory at each indexed root. Store metadata and keyword index data in SQLite with FTS5.

```text
<repo-or-vault-root>/
+-- .sce/
    +-- metadata.sqlite
    +-- cache/
    +-- logs/
```

Conceptual storage tables:

- `repositories` stores indexed roots and repository type.
- `files` stores relative path, hash, language, and last indexed timestamp.
- `chunks` stores chunk metadata, text, and line ranges.
- `chunk_links` stores Markdown `[[wiki-links]]` from a source chunk to a target string or path.
- `chunks_fts` is an FTS5 virtual table for keyword retrieval.
- `index_events` or `stats` may store diagnostics such as indexing and search timings.

SQLite is an implementation detail behind `IMetadataStore` and `IKeywordIndex`. Later vector storage can be added beside this without changing the public API.

## Keyword Retrieval And Vault Indexing

V1 optimizes for Markdown vaults but uses the same indexing pipeline for repository types.

Indexing behavior:

- Walk user-provided roots only.
- Apply default ignores and user config.
- Exclude `.git`, `.sce`, dependency directories, build outputs, caches, binaries, and generated directories.
- Index Markdown first.
- Chunk Markdown by heading.
- Treat a file with no headings as one file-level chunk.
- Preserve heading path, line range, chunk text, file hash, and outgoing wiki-links.

Keyword search behavior:

- Search chunk text through SQLite FTS5.
- Include stored path, file name, and heading metadata in ranking.
- Boost exact phrase and identifier-like matches.
- Boost file name and heading matches.
- Return concise hits with snippet, path, line range, score, and chunk id.
- Use `getChunk(id)` when an agent needs the full chunk text.

V1 does not implement embeddings, AST parsing, hybrid merge, reranking, or graph traversal.

## CLI Surface

The CLI is a thin adapter over `core`.

Initial commands:

```bash
sce index <path> --type vault
sce update <path>
sce search "query" --path <path> --limit 10
sce chunk <chunk-id> --path <path>
sce stats <path>
```

CLI output defaults to concise human-readable text. `--json` returns stable structured output matching core result models. Exit codes should be predictable: `0` for success and nonzero for path, config, index, or validation errors.

## MCP Surface

The MCP server is a thin adapter over `core`.

Initial tools:

- `sce_index_repository`
- `sce_update_repository`
- `sce_search`
- `sce_get_chunk`
- `sce_stats`

Use one general `sce_search` tool with filters instead of a dedicated vault search tool. This keeps the surface smaller and more stable.

MCP responses should be compact by default to protect token budget. Options such as `limit`, `includeText`, and `maxChars` can control response size.

Security posture:

- Local filesystem only.
- No network calls required.
- No automatic indexing outside explicit user-provided paths.
- No hidden repo crawling.

## Configuration

Use optional repo-local JSON config:

```text
sce.config.json
```

If the file is absent, SCE uses conservative defaults.

Example shape:

```json
{
  "repositories": [
    {
      "path": ".",
      "type": "vault",
      "name": "local-vault"
    }
  ],
  "indexing": {
    "include": ["**/*.md"],
    "ignore": [".git/**", ".sce/**", "node_modules/**", "dist/**", "build/**"]
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

Default ignores always apply. User ignores add exclusions. User includes narrow what gets indexed. V1 should avoid a complex precedence system.

## Logging And Diagnostics

Use structured logs internally while keeping CLI quiet by default.

- Normal CLI output includes only command results.
- `--verbose` enables progress and timing output.
- MCP diagnostics are optional and off by default.
- Logs may include files scanned, chunks generated, search time, indexing time, cache hits, cache misses, and errors.
- Full chunk text should not be logged by default.

## Testing Strategy

Use Vitest for unit and integration tests.

Unit test coverage:

- Markdown chunking for no-heading files, heading sections, nested heading paths, and wiki-link extraction.
- Ignore rules for defaults, user ignores, and user includes.
- Ranking for heading and filename boosts, limits, and snippet behavior.
- Config parsing for absent config, valid config, and invalid config errors.

Integration coverage:

- Use `fixtures/sample-vault/` with real Markdown files.
- Index a fixture vault.
- Search by exact phrase, title, and wiki-link context.
- Fetch a chunk by id.
- Modify a file and run update.
- Verify deleted and changed chunks are reflected.

CLI coverage:

- `sce index`
- `sce search --json`
- `sce chunk`
- Missing path and unindexed path exit codes.

MCP coverage:

- Prefer protocol-level tests if low-friction.
- Otherwise test handlers against mocked core APIs and compact structured responses.

Performance coverage:

- Include a small fixture smoke test.
- Track timings as diagnostics.
- Do not set strict performance gates in v1.

## Explicit Non-Goals For First Slice

- No Pasttime integration.
- No Cloudflare deployment or web UI.
- No embeddings or vector database implementation.
- No AST search implementation.
- No hybrid retrieval implementation.
- No graph traversal implementation.
- No full codebase language parser set.
- No automatic indexing of arbitrary paths.

## Acceptance Criteria For The Design

- Package boundaries match the GOAL modules without excessive package ceremony.
- One retrieval strategy is implemented in the first slice, with plugin slots for later strategies.
- Agents can index a Markdown vault and retrieve concise local context through CLI or MCP.
- Public API remains stable enough for later semantic, AST, hybrid, and web UI work.
- Local storage is transparent and swappable behind interfaces.
- Pasttime remains untouched.
