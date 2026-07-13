# AST Symbol Lookup Slice — Continuation Handoff

**Date:** 2026-07-13
**Session started:** Brainstorming → design → plan → implementation (Tasks 1–12)
**Where it stopped:** Task 1 implementer completed and committed. Task 1 reviewer failed (model usage limit 429).
**Branch:** `develop` (clean, no uncommitted changes)
**Unpushed since:** commit `231d9e8` (plan) onward

---

## What Was Completed (Before This Session)

The full code-indexing and hybrid-search slices were already shipped. The continuation handoff from the previous session was at `HANDOFF-PROMPT.md`.

## What This Session Completed

### 1. AST Symbol Lookup — Brainstorming, Design, Plan (DONE)

**Spec** (source of truth): `docs/superpowers/specs/2026-07-13-sce-ast-symbol-lookup-slice-design.md` (commit `51b3f04`)

Locked decisions:
- New `symbols` table (write-aside, no `chunks` migration)
- Tiered search: exact first → prefix fallback; `matchType: "exact" | "prefix"` on `SymbolHit`
- `AstRetrievalStrategy` uses direct scoring (not `SimpleRanker`): exact=1.0, prefix=0.5+matchedLength/nameLength
- AST always wired (no `embedding` gate; empty results on Markdown-only vaults)
- `symbolKind` rejected with clear error on keyword/semantic/hybrid
- Duplicate-name ranking via `qualified_name` length + `symbol_kind_priority`
- Empty `text` rejected
- `pathFilter` parity with keyword (shared helper parameterized by column expression)

**Plan** (implementation guide): `docs/superpowers/plans/2026-07-13-sce-ast-symbol-lookup-slice.md` (commit `231d9e8`)
- 13 tasks, each with full code, failing tests → implement → green → commit
- Each task references exact files to create/modify

### 2. AST Symbol Lookup — Task 1 (DONE, committed)

**Commit:** `c88eeae feat(core): add ISymbolIndex interface and symbolKind on SearchQuery/SearchHit`

Files changed:
- `packages/core/src/models/Search.ts` — added optional `symbolKind?: SymbolKind` to `SearchQuery` + `SearchHit`
- `packages/core/src/models/SymbolSearchQuery.ts` — NEW: `SymbolSearchQuery` interface
- `packages/core/src/models/SymbolHit.ts` — NEW: `SymbolHit` interface with `matchType: "exact" | "prefix"`
- `packages/core/src/interfaces/SymbolIndex.ts` — NEW: `ISymbolIndex` interface (`indexSymbols`, `removeSymbolsForFile`, `deleteByRepository`, `searchSymbols`)
- `packages/core/src/index.ts` — added exports

Verified: `SymbolHit` has `matchType`, `ISymbolIndex` shape correct, 126 tests green, typecheck+build clean.

### 3. Task 1 Review (NOT DONE)

Reviewer subagent hit model usage limit (429) before producing any output. **This review needs to be done first before proceeding to Task 2.**

---

## What Needs to Happen Next

### Immediate (before any new work)

1. **Review Task 1** — the reviewer failed; do a quick review of `c88eeae` against the plan's Task 1 spec. The diff is trivial (5 files, +37 lines, all optional fields + interfaces + exports). Check:
   - `SymbolSearchQuery` fields match plan exactly
   - `SymbolHit` has `matchType: "exact" | "prefix"` (not just `matchType: string`)
   - `ISymbolIndex` methods match plan: `indexSymbols(chunks: Chunk[])`, `removeSymbolsForFile(repositoryId, relativePath)`, `deleteByRepository(repositoryId)`, `searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]>`
   - `symbolKind?: SymbolKind` added to both `SearchQuery` and `SearchHit` in `Search.ts`
   - All three new files + the two modifications are exported from `index.ts`

### Continue Implementation (Tasks 2–13)

Each task is a fresh implementer subagent → reviewer → next task. The plan at `docs/superpowers/plans/2026-07-13-sce-ast-symbol-lookup-slice.md` has all the code verbatim.

**Task order:**

| # | Task | Package | Depends on |
|---|------|---------|------------|
| 2 | Extract shared `pathFilter` helper | `@sce/storage` | — |
| 3 | `symbols` table schema | `@sce/storage` | — |
| 4 | `SqliteSymbolIndex` write methods | `@sce/storage` | 2, 3 |
| 5 | `SqliteSymbolIndex.searchSymbols` | `@sce/storage` | 4 |
| 6 | `AstRetrievalStrategy` | `@sce/retrieval` | 1 (done) |
| 7 | `symbolKind` rejection on keyword/semantic/hybrid | `@sce/retrieval` | 1 (done) |
| 8 | Core routing for AST mode | `@sce/core` | 1 (done), 6, 7 |
| 9 | Indexer writes/prunes symbols | `@sce/indexing` | 2, 3 |
| 10 | Runtime always wires astStrategy | `@sce/runtime` | 4, 5, 6, 9 |
| 11 | CLI `--mode ast` + `--symbol-kind` | `@sce/cli` | 8 |
| 12 | MCP `sce_search` accepts ast + symbolKind | `@sce/mcp` | 8 |
| 13 | Document in README + HANDOFF | docs | all |

**Independence clusters** (tasks that don't depend on each other, could be parallelized if subagent concurrency allows):
- Tasks 2 + 3 (both just storage, no interdependency)
- Tasks 6 + 7 (both just retrieval, only depend on Task 1)
- Tasks 11 + 12 (both just CLI/MCP, only depend on Task 8)

**Critical path:** 2/3 → 4 → 5 → 10 → done

### After All Tasks Complete

1. **Final whole-branch review** — reviewer inspects all commits since `231d9e8` (the plan) against both the spec and the plan
2. **Final QA** — `npm run typecheck && npm run build && npm test` — expect 126 baseline + new AST tests
3. **Update progress-ast-lookup.md** — mark all tasks complete
4. **Commit** the progress file + any HANDOFF updates
5. **Do NOT push** unless user explicitly asks

---

## Key Files to Read

| File | Why |
|------|-----|
| `docs/superpowers/specs/2026-07-13-sce-ast-symbol-lookup-slice-design.md` | Source of truth — locked decisions |
| `docs/superpowers/plans/2026-07-13-sce-ast-symbol-lookup-slice.md` | Implementation guide — all 13 tasks with code |
| `.superpowers/sdd/progress-ast-lookup.md` | Task completion tracker |
| `.superpowers/sdd/task-1-report.md` | What Task 1 implementer built |
| `.superpowers/sdd/review-231d9e8..c88eeae.diff` | Diff for Task 1 (review failed, needs redo) |
| `packages/core/src/interfaces/SymbolIndex.ts` | Task 1 output — `ISymbolIndex` interface |
| `packages/core/src/models/SymbolHit.ts` | Task 1 output — `SymbolHit` with `matchType` |
| `packages/core/src/models/SymbolSearchQuery.ts` | Task 1 output — `SymbolSearchQuery` |

---

## Commits on `develop` (unpushed)

```
c88eeae feat(core): add ISymbolIndex interface and symbolKind on SearchQuery/SearchHit
231d9e8 docs: add AST symbol lookup slice implementation plan
51b3f04 docs: add AST symbol lookup slice design
fba7fec fix(parsing): hasError debug log, const-bound text, and test hardening
0ad1646 docs: document code indexing (AST chunking) slice as shipped
347bf11 test(runtime): integration test for mixed md/ts indexing and code search
20a4173 feat(indexing,runtime): wire detectLanguage, text-skip cleanup, and chunker registry
fe564c2 feat(parsing): add LanguageChunkerRegistry for language dispatch
```

---

## Constraints (unchanged)

- Branch `develop` only; no `main` commits; no push; no PR unless explicitly asked
- `npm run typecheck && npm run build && npm test` green before each commit
- Each task = one commit; do not squash
- Markdown behavior unchanged; no `sce.config.json` changes
- Pasttime untouched
- `ISymbolIndex` lives in `@sce/core`; `SqliteSymbolIndex` in `@sce/storage`
- `pathFilter` SQL shared via `packages/storage/src/pathFilter.ts` (parameterized by column expression)
- The `text`-skip path must NOT call `symbolIndex.removeSymbolsForFile`

## Risks / Watch-Outs

- **Reviewer model limit (429):** the reviewer agent may hit the same limit again. If so, you can do a self-review by reading the diff and checking against the plan, or try the reviewer again (the limit may be per-model, and it might work with a different model if available).
- **Task 2 `pathFilter` extraction** must preserve keyword's existing behavior exactly — the `SqliteStorage` refactoring changes a hardcoded `chunks_fts.relative_path` to a parameterized column, but the SQL must stay identical.
- **Task 5 `runTier` method** has a subtle issue in the plan: it calls `buildPathFilterClause(query.pathFilter, "symbols.relative_path")` but `buildPathFilterClause` is in a separate file — make sure the import is correct.
- **Task 10 runtime wiring** uses `storage.getDatabase()` — verify this method exists on `SqliteStorage` (it does; it's used by the vector store already).
