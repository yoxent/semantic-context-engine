# SCE AST Symbol Lookup Slice Design

Date: 2026-07-13
Status: Approved for planning
Branch target: `develop`

## Purpose

Add the first working `mode: "ast"` search to SCE: symbol lookup by name (with optional `symbolKind` filter) over the `symbolKind`-tagged code chunks the code-indexing slice produces. Answers GOAL.md's "find symbol by name" / "type lookup" / "method lookup" / "navigation" use cases. Builds directly on the `symbolKind` + ancestry metadata shipped in the code-indexing slice. Honors `repositoryIds`/`pathFilter`/`language` (unlike semantic/hybrid). No call hierarchy, references, or inheritance yet — those are later slices. This is Slice 2 of the AST-search work; Slice 1 (code file indexing / AST chunking) is shipped.

## Locked Decisions

- **Symbol storage: separate `symbols` table** (write-aside), no migration to the existing `chunks` table. Schema: `id INTEGER PRIMARY KEY AUTOINCREMENT, chunk_id TEXT NOT NULL, repository_id TEXT NOT NULL, relative_path TEXT NOT NULL, language TEXT NOT NULL, symbol_kind TEXT NOT NULL, name TEXT NOT NULL, qualified_name TEXT NOT NULL`. Indexes on `(repository_id, name)`, `(repository_id, symbol_kind, name)`, `(repository_id, relative_path)`. `qualified_name` = the chunk's `headingPath` joined by `/` (e.g. `Foo/bar`), stored once at index time. `SqliteSymbolIndex` reuses the shared `.sce/metadata.sqlite` DB via `SqliteSymbolIndex.attach(db)` (same pattern as `SqliteVectorStore`).
- **Symbol metadata persistence (gap fix).** The code-indexing slice added `symbolKind`/`className`/`namespace`/`methodName` to the `Chunk` model but `SqliteStorage` does not persist them through the `chunks` table. This slice does **not** fix that for the `chunks` table — instead, the `symbols` table captures the symbol-relevant fields (`symbol_kind`, `name`, `qualified_name`) as the query surface. The `Chunk` model fields remain populated in memory by the chunker and used for building `symbols` rows at index time; round-trip persistence of `Chunk.symbolKind` through `chunks` is out of scope. The `symbols` table is the source of truth for AST queries.
- **Query shape: add optional `symbolKind?: SymbolKind` to `SearchQuery`**; `text` carries the symbol name. Keyword/semantic/hybrid **reject `symbolKind`** with a clear unsupported-filter error (`"symbolKind is not supported in <mode> mode"`), same pattern as `pathFilter`/`language` rejection in semantic/hybrid.
- **Name matching: tiered, case-insensitive.** Exact match (`name = ? COLLATE NOCASE`) first; if the exact tier yields zero hits, prefix match (`name LIKE ?% COLLATE NOCASE`) runs as a true fallback. Both tiers carry `AND symbol_kind = ?` when `symbolKind` is specified, plus `repositoryIds`/`pathFilter`/`language` filters at the SQL level.
- **Prefix is true fallback.** The prefix tier runs **only when the exact tier yields zero hits**. If exact yields ≥1 hit, return up to `limit` of those — no prefix top-up. `limit = query.limit ?? defaultLimit`; no over-fetch (AST queries an indexed table, not a ranker that benefits from a candidate pool).
- **Empty/whitespace `text` rejected.** The strategy throws `"AST search requires a non-empty symbol name"` for empty or whitespace-only `text`. Prevents prefix `LIKE "%"` matching every symbol.
- **Scoring: direct, no `SimpleRanker`.** The strategy reads `SymbolHit.matchType`: exact match (`matchType === "exact"`) → `score = 1.0`; prefix match (`matchType === "prefix"`) → `score = 0.5 + matchedLength / nameLength` (where `matchedLength` = length of the query `text`, `nameLength` = length of the matched symbol's name). The AST signal is name-match quality; `SimpleRanker`'s keyword-oriented boosts would muddy it (precedent: hybrid skips `SimpleRanker` after fusion).
- **Duplicate-name ranking.** When multiple symbols match (especially exact matches at score 1.0), order by: `score DESC, length(qualified_name) ASC, symbol_kind_priority, name ASC, chunk_id ASC`. `symbol_kind_priority` is a CASE mapping: `class`/`interface`/`type`/`enum`/`namespace` = 0 (prominent types), `function`/`arrow`/`function-expr` = 1, `method` = 2 (most nested). So "find `Widget`" returns the class before its same-named method; top-level symbols rank before deeply-nested ones. Applied within each tier (exact, then prefix) in the SQL `ORDER BY`.
- **Filters at SQL level.** `repositoryIds` → `IN (...)`; `pathFilter` → exact/prefix/GLOB on `relative_path` (same semantics as keyword, via a shared helper); `language` → `= ?`. Applied before hydration to avoid wasted `getChunks` calls.
- **`pathFilter` parity with keyword.** AST uses the *identical* `pathFilter` SQL logic as keyword search (exact / directory prefix / GLOB). Implementation requirement: extract keyword's `pathFilter` SQL into a shared helper in `@sce/storage`; both `SqliteStorage` (keyword) and `SqliteSymbolIndex` (AST) call it. Preserve keyword's existing behavior exactly.
- **`SearchHit` gains optional `symbolKind?: SymbolKind`.** Set only for AST hits (from the `symbols` row). Other modes leave it unset. CLI/MCP can render `class Widget` instead of just `Widget`; agents can filter hits by kind as structured data.
- **Return shape: existing `SearchHit`** (no new `AstSearchHit` type). `AstRetrievalStrategy` hydrates `chunk_id` → `Chunk` via `metadataStore.getChunks` (reusing the semantic path), shapes `SearchHit` with `strategy: "ast"`, the direct score, `path`/`startLine`/`endLine`/`headingPath`/`snippet` from the chunk, and `symbolKind` from the `symbols` row.
- **`ISymbolIndex` interface in `@sce/core`**; `SqliteSymbolIndex` implementation in `@sce/storage`. Interface: `indexSymbols(chunks: Chunk[]): Promise<void>`, `removeSymbolsForFile(repositoryId: string, relativePath: string): Promise<void>`, `deleteByRepository(repositoryId: string): Promise<void>`, `searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]>`. `SymbolSearchQuery = { name: string; symbolKind?: SymbolKind; repositoryIds?: string[]; pathFilter?: string; language?: string; limit: number }`. `SymbolHit = { chunkId: string; symbolKind: SymbolKind; name: string; qualifiedName: string; relativePath: string; matchType: "exact" | "prefix" }`. `searchSymbols` runs the tiered lookup internally (exact first; prefix only if exact yields zero) and tags each hit with `matchType` so the strategy can compute the score without re-deriving the tier. Hydration goes through the existing `metadataStore.getChunks` (the symbol index is purely the query + write surface).
- **Lifecycle: mirror the chunks lifecycle.** Indexer writes symbols alongside chunks/FTS/vectors: on file index/reindex, after `saveChunks`/`indexChunks`, call `symbolIndex.removeSymbolsForFile(repoId, relPath)` then `symbolIndex.indexSymbols(chunks)` (which internally skips chunks without a `symbolKind` — Markdown + zero-declaration fallback chunks produce no rows); on file prune, `symbolIndex.removeSymbolsForFile(...)`; on repository delete, `symbolIndex.deleteByRepository(...)`. Symbols never go stale (same delete-then-insert pattern as FTS/vectors).
- **`AstRetrievalStrategy` in `@sce/retrieval`** implementing `IRetrievalStrategy` (`name = "ast"`). Deps: `{ symbolIndex: ISymbolIndex; metadataStore: IMetadataStore; defaultLimit: number; maxSnippetChars: number }`. Validates `text` non-empty; honors `symbolKind`/`repositoryIds`/`pathFilter`/`language`; runs tiered exact-then-prefix via `symbolIndex.searchSymbols`; scores directly; hydrates via `metadataStore.getChunks`; shapes `SearchHit` with `strategy: "ast"` and `symbolKind` from the `SymbolHit`. No `SimpleRanker`.
- **Wiring: AST always wired, no config gate.** `createEngine` always constructs `SqliteSymbolIndex.attach(storage.getDatabase())` + `AstRetrievalStrategy` and injects `astStrategy`. `search({ mode: "ast" })` / `astSearch()` always route to it. Empty symbol table → empty results (not an error). The existing `"Search mode ast is not implemented in v1"` error is removed; the core test asserting it is updated. Rationale: AST has no external dependency (no embedding server) — the symbol index is populated whenever code chunks are indexed and empty when they're not; empty results are the correct answer for a Markdown-only vault, not a misconfiguration.
- **`SemanticContextEngineDeps` gains optional `astStrategy?: IRetrievalStrategy`** (parallel to `semanticStrategy`/`hybridStrategy`). `search({ mode: "ast" })` and `astSearch()` route to it, or throw `"AST search is not configured"` when `astStrategy` is absent (only seen in direct-construction unit tests; runtime always wires it).
- **CLI/MCP: accept `mode: "ast"`** / `--mode ast`; forward to `engine.search`. CLI adds `--symbol-kind <kind>`; MCP `sce_search` adds a `symbolKind` field. Default remains `keyword`.
- **Non-goals:** no call hierarchy, references, or inheritance (Slice 3); no AST-in-hybrid (Slice 4); no `qualified_name` as a query input (Slice 3 — the column exists for ranking only this slice); no signature storage; no migration of the `chunks` table for `symbolKind` columns; no `Optimize()`/reconcile pass; no new embedding providers; no Pasttime coupling; no PR. Work lands on `develop` only; `main` stays production-only.

## Implementation Requirements

Binding on the implementation plan (not optional design alternatives):

- The `symbols` table is created in `createSchemaSql` alongside `chunks`/`chunks_fts`/`vectors` via `CREATE TABLE IF NOT EXISTS`, so existing `.sce/metadata.sqlite` files get the table on next `SqliteStorage.open`.
- `SqliteSymbolIndex.indexSymbols` follows the indexer's per-file delete-then-insert ordering: `removeSymbolsForFile(repoId, relPath)` then insert, ordered after `saveChunks`/`indexChunks` for that file — same ordering as the FTS/vectors writes. This keeps symbols and chunks in sync per file.
- Extract the keyword `pathFilter` SQL (exact / directory prefix / GLOB on `relative_path`) into a shared helper in `@sce/storage`; both `SqliteStorage` (keyword) and `SqliteSymbolIndex` (AST) call it. Preserve keyword's existing behavior exactly — this is a refactor to shared code, not a behavior change for keyword.
- The strategy is the gatekeeper for empty `text` (throws before calling `searchSymbols`); `searchSymbols` itself may assume a non-empty `name` (defensive: return `[]` if called with empty).
- The `text`-skip path (unsupported-language files, e.g. `.json`) must **not** call `symbolIndex.removeSymbolsForFile` — `text`-language files never had symbols (no `symbolKind`), so there is nothing to clean. Symbol cleanup happens on the **prune** path (discovered files no longer in `include`) and the **re-index** path (changed file), both of which already delete-then-insert. The plan must be explicit about this so the implementer doesn't add a spurious `removeSymbolsForFile` to the text-skip branch.
- `KeywordRetrievalStrategy` gains `symbolKind` rejection — the first validation logic added to that file. The plan touches `packages/retrieval/src/KeywordRetrievalStrategy.ts` for the first time; this is expected, not a regression. Keep the rejection error wording consistent with semantic/hybrid: `"symbolKind is not supported in keyword mode"`.

## Known Edge Cases (best-effort / future)

- **Non-ASCII case-insensitivity.** SQLite `COLLATE NOCASE` folds only ASCII A-Z. Symbols with non-ASCII names (e.g. `café`) queried with different casing won't match. Real TS/JS identifiers are ASCII; accepted best-effort.
- **Same-named symbols across repositories.** `repositoryIds` filters at SQL level; without it, same-named symbols from multiple repos interleave by the ranking order. Acceptable — agents typically scope with `repositoryIds`.
- **AST results do not have the overlapping-chunks problem.** The symbol index is 1 row per symbol (not per chunk-text-range), so a class and its method are separate rows — no overlap, even though their chunks overlap. (Documented because the code-indexing slice's "Gaps in Prior Slices" flagged overlapping chunks as a semantic/hybrid concern; AST is unaffected.)

## Error Handling

- **Empty/whitespace `text`:** throw `"AST search requires a non-empty symbol name"`.
- **`symbolKind` on non-AST modes:** keyword/semantic/hybrid throw `"symbolKind is not supported in <mode> mode"` (same pattern as `pathFilter`/`language` rejection in semantic/hybrid).
- **`astStrategy` absent (direct engine construction only):** `astSearch()` throws `"AST search is not configured"` (runtime always wires it, so real users never see this).
- **Empty symbol table (Markdown-only vault or no code indexed):** not an error — returns `{ hits: [], diagnostics: { strategy: "ast", scannedChunks: 0 } }`.
- **Missing chunk on hydrate:** a `SymbolHit` whose `chunk_id` no longer exists in `chunks` is silently dropped (defensive; the per-file lifecycle keeps them in sync). No error, no partial failure.
- **`pathFilter`/`language` honors:** AST applies them at SQL level (no rejection). Invalid GLOB patterns are SQLite's concern (it treats malformed GLOBs as literal strings — harmless).
- **Indexing failures:** `symbolIndex.indexSymbols` failures propagate (the indexer does not swallow them), same as FTS/vectors write failures.

## Testing Plan

**Unit — `@sce/core`:**
- `SearchQuery.symbolKind` and `SearchHit.symbolKind` compile and are optional.
- `ISymbolIndex` contract test (the interface shape).

**Unit — `@sce/storage`:**
- `SqliteSymbolIndex.indexSymbols` inserts rows only for chunks with a `symbolKind` (skips Markdown + zero-declaration fallback chunks).
- `removeSymbolsForFile` / `deleteByRepository` clean up correctly.
- `searchSymbols` exact match (case-insensitive) returns hits in ranking order (tier, then `qualified_name` length, `symbol_kind_priority`, `name`, `chunkId`).
- Prefix fallback runs only when exact yields zero; prefix hits ranked by the tie-break keys.
- `symbolKind` filter narrows both tiers.
- `repositoryIds`/`pathFilter`/`language` filter at SQL level; `pathFilter` parity with keyword via the shared helper.
- `searchSymbols` with empty `name` returns `[]` (defensive; the strategy is the real gatekeeper).
- `SymbolHit.matchType` is set correctly: exact-tier hits tagged `"exact"`, prefix-tier hits tagged `"prefix"`; when the exact tier yields results, the prefix tier is not run (so no `"prefix"` hits appear alongside `"exact"` hits).

**Unit — `@sce/retrieval`:**
- `AstRetrievalStrategy`: rejects empty `text`; reads `SymbolHit.matchType` to score (`exact` → `1.0`, `prefix` → `0.5 + matchedLen/nameLen`); `symbolKind` filter forwarded; `repositoryIds`/`pathFilter`/`language` forwarded; hydrates via `getChunks` and drops missing chunks; `SearchHit.symbolKind` set from `SymbolHit`; `strategy: "ast"`; `scannedChunks` = unique chunk ids before slice; `limit` respected; ranking order preserved from SQL.

**Unit — `@sce/core` (engine routing):**
- `search({ mode: "ast" })` routes to `astStrategy` when wired; `astSearch()` delegates with `mode: "ast"`.
- `astSearch()` throws `"AST search is not configured"` when `astStrategy` absent.
- The existing "ast is not implemented in v1" test is updated (ast now routes, not rejects).
- Keyword/semantic/hybrid reject `symbolKind` with the unsupported-filter error.

**Unit — `@sce/indexing`:**
- Indexer calls `symbolIndex.removeSymbolsForFile` + `indexSymbols` after `indexChunks` on file index/reindex.
- Indexer calls `removeSymbolsForFile` on prune.
- `indexSymbols` skips chunks without a `symbolKind`.

**Integration — `@sce/runtime`:**
- `createEngine` always wires `astStrategy` (no config gate); indexing a repo with `.ts` files populates the symbol table; `engine.astSearch({ text: "Widget" })` returns the class hit with `symbolKind: "class"`.
- Markdown-only repo: `astSearch` returns empty results (not an error).

**Integration — CLI/MCP:**
- `sce search Widget --path ./repo --mode ast` returns the symbol hit.
- `sce search render --mode ast --symbol-kind method` returns only method hits.
- MCP `sce_search` with `mode: "ast"` + `symbolKind` routes correctly.
- `symbolKind` with `--mode keyword` surfaces a clear error.

**Regression:** existing keyword/semantic/hybrid/code-indexing tests stay green. Markdown behavior unchanged. The core "ast is not implemented" test is updated (it now asserts routing, not rejection).

## Documentation

- **README:** document `mode: "ast"` + `--mode ast` + `--symbol-kind` / MCP `symbolKind`; explain name + optional kind lookup, tiered exact-then-prefix matching, that AST honors `pathFilter`/`language` (unlike semantic/hybrid), that `symbolKind` is rejected on other modes, and that AST is always available (no `embedding` gate). Note AST returns empty results on Markdown-only vaults.
- **HANDOFF:** add this slice to canonical docs and shipped subsections; keep call hierarchy, references, inheritance, AST-in-hybrid, and `qualified_name`-as-query-input as follow-ups.

## Future Work

- **Richer AST queries (Slice 3):** call hierarchy, references, inheritance. Extends the symbol index with richer query shapes (`qualifiedName` as a query input, `referenceTarget`, `symbolKind`-aware traversal). Likely needs a richer `ast?` query object on `SearchQuery`.
- **AST in hybrid (Slice 4):** add AST as a third RRF list in `HybridRetrievalStrategy`; the private `fuseRrf` helper moves to `@sce/ranking` (already anticipated by the hybrid design's Future Work).
- **`Chunk.symbolKind` persistence through `chunks`:** if a future slice needs `symbolKind` on hydrated chunks (without joining `symbols`), add the columns to `chunks` + a migration. Out of scope here; the `symbols` table is the source of truth for AST.
- **`Optimize()` / global reconcile:** the per-file lifecycle prevents orphans; `Optimize()` is a separate GOAL.md feature for broader cleanup.
- **Non-ASCII-aware case folding:** if non-ASCII symbol names become common, switch to a Unicode-aware comparison.
