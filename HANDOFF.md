# Handoff: Semantic Context Engine (SCE)

## Current state (2026-07-13)

First interface-first vertical, ops polish, ranking, the opt-in semantic search slice, and the opt-in hybrid search slice are implemented on **`develop`**.

- Branch: `develop` (tracks `origin/develop`)
- `main` is production-only — do not land feature work there yet

## Canonical docs

- `README.md` — how to run the shipped vertical
- `GOAL.md` — long-term vision (still ahead of v1)
- `docs/superpowers/specs/2026-07-12-sce-interface-first-vertical-design.md` — approved design
- `docs/superpowers/plans/2026-07-12-sce-interface-first-vertical.md` — plan that was executed
- `docs/superpowers/specs/2026-07-13-sce-semantic-search-slice-design.md` — approved semantic slice design
- `docs/superpowers/plans/2026-07-13-sce-semantic-search-slice.md` — semantic slice implementation plan
- `docs/superpowers/specs/2026-07-13-sce-hybrid-search-slice-design.md` — approved hybrid slice design
- `docs/superpowers/plans/2026-07-13-sce-hybrid-search-slice.md` — hybrid slice implementation plan

## Locked product decisions

- SCE is the product; primary consumer = AI coding agents; secondary = human presentation later
- Pasttime is unrelated in code (DNS/subdomain borrowing only, later)
- Approach: interface-first thin vertical
- First agent surface: vault + CLI/MCP on one public API
- Human Obsidian-like UI later inside SCE, not Pasttime

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

## Known follow-ups

- AST search strategies
- Binary vector layout / ANN index (`.sce/semantic/` layout)
- Cloud-only embedding providers
- Human UI on obscure Cloudflare subdomain

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

## For the next agent

1. Read `README.md` and the design spec.
2. Work on `develop`, not `main`.
3. Prefer small plans for the next capability slice (hybrid search, AST search, binary vectors/ANN, cloud-only embedding providers, or UI).
4. Keep Pasttime untouched.
