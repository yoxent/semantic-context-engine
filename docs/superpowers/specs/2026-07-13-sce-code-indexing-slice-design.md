# SCE Code File Indexing (AST Chunking) Slice Design

Date: 2026-07-13
Status: Approved for planning
Branch target: `develop`

## Purpose

Extend SCE's indexing from Markdown-only to TypeScript/JavaScript code. Code files are chunked by AST declaration nodes (functions, classes, interfaces, etc.) instead of Markdown headings, and each chunk carries symbol metadata (`symbolKind`, ancestry) that the later AST-search slice will query. This slice ships working keyword, semantic, and hybrid search over code — no new search mode is introduced. Markdown behavior stays byte-for-byte unchanged for existing vault users.

This is the first sub-slice of the AST-search work from `GOAL.md`. It is the prerequisite for a later "AST symbol lookup" slice (`mode: "ast"`) and for "AST in hybrid" after that.

## Locked Decisions

- **Languages:** TS + JS only. `.ts`, `.tsx`, `.mts`, `.cts` → `typescript`; `.js`, `.jsx`, `.mjs`, `.cjs` → `javascript`. Generators fold into `function` / `method` (no separate generator kinds).
- **Parser:** `web-tree-sitter` (WASM runtime, loaded from the `web-tree-sitter` npm package) plus `tree-sitter-typescript` and `tree-sitter-javascript` grammar `.wasm` files **vendored** into `packages/parsing/grammars/`, loaded at runtime via `import.meta.url`-relative paths. No native compilation, no install-time toolchain required.
- **Chunk targets — 9 `symbolKind` values:** `function`, `method`, `arrow`, `function-expr`, `class`, `interface`, `type`, `enum`, `namespace`. A `const` / `export const` binding an arrow function → `arrow`; binding a function expression → `function-expr`. Plain data `const` declarations (e.g. `const PI = 3.14`) are **not** chunked. Unnamed declarations (e.g. `export default function () {}`) are **skipped** — no name means nothing to address.
- **Symbol metadata on `Chunk`:** add one optional field `symbolKind?: SymbolKind`. Reuse the existing optional fields for ancestry: `headingPath` = ancestry **including self** (e.g. `["Foo", "bar"]` for method `bar` on class `Foo`); `className` = immediate enclosing class name (else unset); `namespace` = enclosing namespace name (else unset); `methodName` = the symbol's own name when `symbolKind === "method"`, else unset. No richer `symbol` object in this slice.
- **Chunker boundary:** `LanguageChunkerRegistry` (implements `IChunker`) dispatches `chunk(input)` by `input.language`. One `TreeSitterCodeChunker` class, constructed per grammar — TS and JS share the class and differ only by the loaded grammar. `MarkdownChunker` is unchanged. `IChunker` interface and `IndexingService` structure are untouched (the registry is injected as the single `chunker` dep).
- **Language detection:** new `Language` type (`"markdown" | "typescript" | "javascript" | "text"`) and `detectLanguage(relativePath): Language` helper in `@sce/core`, replacing `Indexer`'s private hardcoded `languageFor()`. Unknown extensions map to `"text"`.
- **Unknown-language handling:** files whose `detectLanguage` is `"text"` are **skipped by the indexer before `readFile`** — no file record, no chunks, a debug log. They are never handed to the registry. No error, no fallback chunker, no whole-file chunk.
- **Default `indexing.include`:** stays `["**/*.md"]` (Markdown-only). Code indexing is **opt-in** via `sce.config.json` `indexing.include` (documented in README). Respects "no default-behavior change for existing users."
- **Embedding:** when `embedding` is configured, code chunks are embedded uniformly — the indexer's existing embedding loop is already language-agnostic (`embed(chunks.map(c => c.text))`). No new config keys, no new rebuild boundary. The existing model/dimensions rebuild guard covers code chunks identically.
- **Chunk id for code chunks:** `sha256(repositoryId:relativePath:startLine:endLine:symbolKind:name:fileHash)` — includes `symbolKind` and `name` to avoid collisions when a class and its one-line method share the same line range (e.g. `class Foo { bar() {} }`). `MarkdownChunker` keeps its existing id scheme (headings never collide on range).
- **Code chunk `text`:** the full declaration node's text (signature + body), for every kind — the direct analog of "whole class body." A class chunk therefore overlaps its method chunks' ranges; this mirrors Markdown's existing behavior where a parent heading chunk contains its children's text. Any dedup of overlapping hits is a future ranker/search concern, not this slice.
- **Traversal:** manual cursor traversal (one pre-order pass over the syntax tree, matching node types in code), **not** tree-sitter query DSL. This handles the const-bound-arrow / function-expression case cleanly (`variable_declarator` whose `value` child is `arrow_function` / `function_expression`). An ancestor stack of class/namespace names supplies the ancestry for `headingPath` / `className` / `namespace`.
- **Parse-error handling:** best-effort. tree-sitter has error recovery; chunk the valid declaration nodes, **never throw** on syntax errors, and emit a debug log when `rootNode.hasError` is true.

## Implementation Requirements

These are binding on the implementation plan (not optional design alternatives):

- The build must make the vendored `.wasm` grammar files resolvable from the built module. `tsc` does not copy `.wasm` into `dist/`, so the plan includes either a copy step or a resolution path that does not depend on `dist/`.
- The `web-tree-sitter` runtime and grammars load **once per process** via a module-level lazy singleton, not per chunker instance, to avoid reloading WASM on every `createEngine` call.
- Tests use the real WASM grammars against small TS/JS fixture snippets. Do not mock tree-sitter.

## Non-Goals

- No `mode: "ast"` search, no symbol index, no call hierarchy, references, or inheritance — those are later slices.
- No second language family (Python, Go, Rust, etc.) — the parser interface is designed to generalize, but only TS/JS ship now.
- No JSON or YAML indexing.
- No plain-text fallback chunker for `text`-language files.
- No dedup of overlapping chunks (class vs. its methods) — future ranker/search concern.
- No new `sce.config.json` keys.
- No Pasttime coupling.
- No PR as part of this slice. Work lands on `develop` only; `main` stays production-only.

## Architecture

Follows existing package boundaries; no new package is created.

- **`@sce/core`** — new `Language` type (`"markdown" | "typescript" | "javascript" | "text"`) and `SymbolKind` type, both exported from `models/`. `detectLanguage(relativePath): Language` helper exported from a new `src/language/detectLanguage.ts` (an extension → language map). `Chunk` gains the optional `symbolKind?: SymbolKind` field alongside its existing optional `namespace` / `className` / `methodName` / `headingPath` fields.
- **`@sce/parsing`** — new `TreeSitterCodeChunker` (implements `IChunker`; constructed with a loaded grammar and the `Language` it handles). New `LanguageChunkerRegistry` (implements `IChunker`; holds `{ markdown: MarkdownChunker, typescript: TreeSitterCodeChunker, javascript: TreeSitterCodeChunker }`; routes `chunk(input)` by `input.language`). Vendored `tree-sitter-typescript.wasm` and `tree-sitter-javascript.wasm` under `packages/parsing/grammars/`. A module-level lazy loader initializes `web-tree-sitter` and loads grammars once. `MarkdownChunker` is unchanged.
- **`@sce/indexing`** — `Indexer.ts` replaces its private `languageFor()` with `detectLanguage()` from `@sce/core`, and adds the `text`-skip guard (skip before `readFile` when `detectLanguage(...) === "text"`). `IndexingServiceDeps.chunker` stays typed `IChunker`; the registry is injected as that single chunker. No other indexer change; the embedding loop is untouched (embeds code chunks uniformly when `embedding` is on).
- **`@sce/runtime`** — `createEngine` builds the `LanguageChunkerRegistry` (markdown chunker + tree-sitter code chunkers) and injects it as `chunker` instead of the current unconditional `MarkdownChunker`. If grammar loading fails, `createEngine` throws a clear configuration error.
- **`@sce/cli` / `@sce/mcp`** — unchanged. No new mode, no new flag. Code files are indexed whenever the user's `indexing.include` globs match them.
- **`README.md` / `HANDOFF.md`** — document code indexing as opt-in (extend `indexing.include`), list the supported extensions and the `symbolKind` set, and note that Markdown default behavior is unchanged.

## Data Flow

For `indexRepository({ rootPath, type })`:

1. `discoverFiles({ include, ignore })` returns relative paths (existing behavior; `include` defaults to Markdown-only, the user extends it for code).
2. For each relative path:
   a. `detectLanguage(relativePath)` → `Language`. If `"text"`, the indexer emits a debug log (`"index.skipUnsupportedLanguage"`) and continues to the next file — no `readFile`, no file record.
   b. `readFile` + `sha256` → `fileHash`. If unchanged since last index, skip (existing).
   c. Delete old chunks / FTS rows / vectors for the file (existing).
   d. `chunker.chunk({ repositoryId, relativePath, language, fileHash, text })` → the **registry routes by `language`** → `MarkdownChunker` for `markdown`, `TreeSitterCodeChunker` for `typescript` / `javascript`.
   e. `TreeSitterCodeChunker`: parse with tree-sitter; if `rootNode.hasError`, debug-log. Cursor-traverse the tree; on each of the 9 declaration kinds extract `{ name, symbolKind, startLine, endLine, ancestry, text }`. Skip unnamed declarations. Build each `Chunk` with the collision-safe id (`symbolKind` + `name` included), `headingPath` = ancestry-including-self, `className` / `namespace` / `methodName` set per the semantics, and `symbolKind` set. Return the chunk list.
   f. `metadataStore.saveFile` + `saveChunks`; `keywordIndex.indexChunks` (existing — FTS now indexes code text too).
   g. If `embedding` is configured: `embeddingProvider.embed(chunks.map(c => c.text))` and `vectorStore.upsert` per chunk (existing — code chunks embedded uniformly).
3. Prune deleted files (existing).

Search flows (`keyword` / `semantic` / `hybrid`) are unchanged in structure — they already operate over all indexed chunks regardless of language. Code chunks simply become searchable alongside Markdown chunks once indexed.

## Error Handling

- **Unknown language (`text`):** skip with a debug log, never throw. `indexing.include` is the contract for what gets indexed.
- **Parse errors:** tree-sitter recovers; chunk valid declaration nodes, debug-log `rootNode.hasError`, never throw.
- **Unnamed declarations:** silently skipped — no error, nothing to address.
- **Missing or unreadable grammar `.wasm` / load failure:** throw a clear configuration error at `createEngine` time (e.g. `"Failed to load tree-sitter grammar: <path> (<cause>)"`). Fail loud at startup, not per file. The lazy singleton means this surfaces on the first `createEngine`, not at module import.
- **`embedding` rebuild boundary (model / dimensions change):** unchanged. Code chunks are subject to the same existing guard; no new boundary.
- **Embedding count mismatch:** the existing `"Embedding provider returned N vectors for M chunks"` error path covers code chunks identically.

## Testing Plan

**Unit — `@sce/core`:**
- `detectLanguage` maps all 7 code extensions and `.md` correctly; unknown extensions → `text`.
- `Language` and `SymbolKind` types compile against `Chunk.symbolKind`.

**Unit — `@sce/parsing` (real WASM grammars, no mocking):**
- `TreeSitterCodeChunker` on small TS fixture snippets: one case per `symbolKind` (function, method, arrow, function-expr, class, interface, type, enum, namespace); `const`-bound arrow → `arrow`; `const`-bound function expression → `function-expr`; plain data `const` skipped; unnamed declaration skipped; `symbolKind` values correct; `headingPath` ancestry-including-self; `className` / `namespace` / `methodName` set per semantics; class chunk = whole body (overlaps its method chunk's range); id includes `symbolKind` + `name` (no collision for one-line `class Foo { bar() {} }`); a syntax-error file yields best-effort chunks and exercises the `hasError` debug path.
- `LanguageChunkerRegistry` routes by `language` to the registered chunker and returns its output. (The indexer guarantees `text`-language files never reach it; that guard is tested at the indexer level.)
- `MarkdownChunker` unchanged — existing tests stay green.

**Unit — `@sce/indexing`:**
- `Indexer` skips `text`-language files (no `readFile`, no file record, debug log); calls `detectLanguage`; code files produce chunks with `symbolKind`; the embedding path embeds code chunks when `embedding` is configured.

**Integration — `@sce/runtime`:**
- `createEngine` wires the registry; indexing a repo with both `.md` and `.ts` files produces both Markdown and code chunks; keyword, semantic, and hybrid search return code hits.

**Regression:** existing keyword, semantic, hybrid, storage, CLI, MCP, and ranking tests must stay green. Markdown-only vault users see no behavior change (default `include` unchanged).

## Documentation

- **README:** document code indexing as opt-in (extend `indexing.include` with the code extensions); list supported extensions and the `symbolKind` set; note that Markdown default behavior is unchanged; note that semantic/hybrid search now also cover code when `embedding` is on.
- **HANDOFF:** add this slice to canonical docs and shipped subsections; keep AST symbol lookup, call hierarchy, references, inheritance, JSON/YAML, and second-language support as follow-ups.

## Future Work

- **AST symbol lookup slice:** add a symbol index (likely SQLite, reusing the `.sce/metadata.sqlite` pattern) + `AstRetrievalStrategy` + route `search({ mode: "ast" })` / `astSearch()`. Builds directly on the `symbolKind` + ancestry metadata this slice populates. Honors `pathFilter` / `language` (unlike semantic/hybrid).
- **Richer AST queries:** call hierarchy, references, inheritance — extend the symbol index with richer query shapes (`symbolKind`, `referenceTarget`, etc.).
- **AST in hybrid:** add AST as a third RRF list in `HybridRetrievalStrategy`; the private `fuseRrf` helper would move to `@sce/ranking` at that point (already anticipated by the hybrid design's Future Work).
- **JSON / YAML indexing:** trivial chunking (whole-file or per-key), no AST — small follow-up.
- **Second language family (Python, Go, Rust, etc.):** the `TreeSitterCodeChunker` + registry design generalizes — add a grammar, extend `detectLanguage`, register the chunker.
- **Overlapping-chunk dedup:** a ranker/search concern once AST search lands and overlapping class/method hits become common.
