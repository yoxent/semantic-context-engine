# SCE Semantic Search Slice Design

Date: 2026-07-13
Status: Approved for planning
Branch target: `develop`

## Purpose

Add the next interface-first retrieval slice for Semantic Context Engine: opt-in semantic search backed by local embeddings and a SQLite vector store. Keyword search remains the default shipped behavior. This slice should give AI coding agents a working `semantic` mode without introducing hybrid search, AST search, a web UI, external vector databases, or Pasttime coupling.

## Locked Decisions

- Semantic search is opt-in through `sce.config.json`.
- The first embedding provider implementation is OpenAI-compatible HTTP, intended for local servers such as Ollama or LM Studio.
- Vectors are stored in SQLite for this slice, under the existing `.sce/metadata.sqlite` persistence boundary.
- The long-term target remains a separate `.sce/semantic/` layout with files such as `embeddings.bin` and `vector.index`, but that layout is explicitly not implemented now.
- Embeddings are generated during `index` and `update`, not lazily during search.
- This slice ships semantic search only. Keyword remains default. Hybrid and AST modes remain unimplemented.
- Pasttime remains untouched in code: no imports, shared packages, links, or product coupling.

## Non-Goals

- No hybrid result merging.
- No cloud-only provider implementation.
- No binary vector file format or ANN index.
- No external vector database dependency.
- No semantic ranking redesign beyond reusing the existing ranking surface where appropriate.
- No web UI.
- No broad GOAL.md implementation beyond this slice.

## Architecture

The design follows the existing package boundaries.

`@sce/embedding` owns embedding providers. It will expose an `OpenAICompatibleEmbeddingProvider` that implements `IEmbeddingProvider` from `@sce/core`. The provider accepts text batches and returns numeric vectors. It does not know about chunks, repositories, storage, ranking, or retrieval.

`@sce/storage` owns vector persistence for this slice. It will provide a SQLite-backed implementation of `IVectorStore`. The first implementation stores vectors in `.sce/metadata.sqlite`, keyed by `chunkId`, with enough metadata to validate dimensions/model and support repository filtering. This is a pragmatic implementation detail behind `IVectorStore`, not the long-term storage contract.

`@sce/retrieval` owns semantic retrieval. A new semantic strategy embeds the query text, searches the vector store, hydrates matching chunks from metadata, and returns normal `SearchHit` objects. The strategy should preserve concise hit output: chunk id, path, line range, snippet, score, strategy, and heading metadata where available.

`@sce/indexing` remains the place where chunk lifecycle is coordinated. Once chunks are saved and keyword FTS is updated, indexing should embed only new or changed chunks when semantic is configured. Deleted chunks must also delete vectors.

`@sce/runtime` wires semantic components only when the config has an `embedding` block. Without that block, runtime creates the current keyword-only engine.

`@sce/core` routes `search({ mode: "semantic" })` and `semanticSearch()` to the semantic strategy when configured. If semantic is not configured, it throws a clear configuration error. `search({ text })` continues to default to keyword.

## Configuration

Semantic search is enabled with an `embedding` block in `sce.config.json`:

```json
{
  "embedding": {
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:11434/v1",
    "model": "nomic-embed-text",
    "dimensions": 768,
    "batchSize": 32
  }
}
```

Required fields when `embedding` is present:

- `provider`: currently only `"openai-compatible"`.
- `baseUrl`: OpenAI-compatible API base URL.
- `model`: embedding model name passed to the provider.
- `dimensions`: expected vector dimension. Used for validation.

Optional fields:

- `batchSize`: defaults conservatively when omitted.
- `apiKeyEnv`: optional environment variable name for a bearer token if a local server requires one. The key itself must not be stored in committed config.

The config documentation must state that SQLite vector storage is the current implementation and `.sce/semantic/` binary/index files are the future goal.

## Index And Update Flow

The existing index/update flow remains authoritative for file discovery, ignore handling, Markdown chunking, metadata save, FTS save, and deleted-file pruning.

When semantic is configured:

1. Compute chunks exactly as today.
2. Save file/chunk metadata exactly as today.
3. Update keyword FTS exactly as today.
4. Embed chunks whose file is new or changed.
5. Upsert each vector by `chunkId`, `repositoryId`, `model`, and `dimensions`.
6. Delete vectors for chunks removed during file prune or file replacement.

Embedding happens during `index` and `update` so semantic search stays fast for coding agents. If semantic is enabled and the embedding provider is unreachable, indexing should fail with a clear error rather than silently leaving a partial semantic index.

## Semantic Search Flow

For `semanticSearch(query)` or `search({ ...query, mode: "semantic" })`:

1. Validate semantic search is configured.
2. Embed `query.text` with the configured provider.
3. Search the vector store with cosine similarity and `query.limit`.
4. Hydrate returned chunk ids through metadata storage.
5. Convert chunks into `SearchHit` values.
6. Apply existing ranking behavior where it helps preserve filename/heading/phrase boosts.
7. Return `SearchResult` with semantic diagnostics.

`repositoryIds` must be supported by the vector store in this slice. `pathFilter` and `language` remain keyword-only for this slice; semantic search should reject them with a clear unsupported-filter error instead of silently ignoring them.

## SQLite Vector Store

The store should implement `IVectorStore` and use SQLite tables in `.sce/metadata.sqlite`.

The SQLite schema must include:

- `chunk_id`
- `repository_id`
- `model`
- `dimensions`
- vector payload
- `updated_at`

The vector payload can be encoded as JSON or a BLOB. Prefer the simplest representation that is easy to test and validate for this slice. The implementation should calculate cosine similarity in process after reading candidate vectors. This is acceptable for the current vault-sized vertical and can be replaced later behind `IVectorStore`.

Dimension mismatches must fail clearly on upsert and query. Changing `model` or `dimensions` is a rebuild boundary for this slice: if existing vectors for a repository use different semantic settings, `index`/`update` should fail with a clear rebuild instruction rather than mixing old and new vectors.

## Error Handling

- Missing `embedding` config: keyword behavior is unchanged; semantic search throws `Semantic search is not configured`.
- Unsupported embedding provider: config parsing fails clearly.
- Embedding server unreachable: `index` or `update` fails clearly when semantic is enabled.
- Malformed provider response: embedding call fails with a provider-specific error.
- Dimension mismatch: vector upsert/search fails with expected and actual dimensions.
- Unsupported `hybrid` and `ast` modes continue throwing as they do today.

## CLI And MCP Surface

CLI and MCP should remain thin adapters over core/runtime.

Minimum surface:

- CLI `search` can request semantic mode with an explicit option such as `--mode semantic`.
- MCP `sce_search` can accept `mode: "semantic"`.
- Default CLI/MCP search remains keyword.

If semantic is requested but not configured, adapters should surface the core error clearly.

## Testing Plan

Unit tests:

- Config parsing/defaults for `embedding`.
- OpenAI-compatible provider request and response handling with mocked `fetch`.
- Provider error handling for non-2xx responses and malformed payloads.
- SQLite vector store upsert, replace, delete, repository filtering, cosine ordering, and dimension mismatch.
- Semantic retrieval strategy: query embedding, vector hits, chunk hydration, `SearchHit` shaping, ranking, and limits.
- Core/runtime routing: semantic configured vs missing; keyword default unchanged.

Integration-style tests:

- Index with semantic configured embeds changed chunks and stores vectors.
- Update after file deletion removes vectors.
- CLI/MCP semantic mode routes through shared core behavior.

Existing tests for keyword indexing, filters, ranking, stats, CLI, and MCP must continue to pass.

## Future Work

The future semantic storage goal is a separate `.sce/semantic/` layout, likely including:

- `embeddings.bin`
- `vector.index`
- semantic cache/config metadata

That future store should still implement `IVectorStore`, so retrieval and runtime do not change when SQLite vectors are replaced. Hybrid search, AST search, ANN indexing, cloud providers, and a human UI remain separate planned slices.
