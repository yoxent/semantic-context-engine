# SCE AST Symbol Lookup Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first working `mode: "ast"` search to SCE: symbol lookup by name (with optional `symbolKind` filter) over the `symbolKind`-tagged code chunks the code-indexing slice produces. A new `symbols` table (write-aside) is populated during indexing and queried by `AstRetrievalStrategy` with tiered exact-then-prefix name matching. AST is always wired (no `embedding` gate); Markdown behavior unchanged; `symbolKind` is rejected on keyword/semantic/hybrid.

**Architecture:** `@sce/core` adds `ISymbolIndex`, `SymbolSearchQuery`, `SymbolHit` (with `matchType`), and optional `symbolKind` on `SearchQuery`/`SearchHit`; `SemanticContextEngineDeps` gains optional `astStrategy`; core routes `mode: "ast"` / `astSearch()` and rejects `symbolKind` on other modes. `@sce/storage` adds `SqliteSymbolIndex` (reusing the shared DB via `.attach(db)`) + a `symbols` table, and extracts the keyword `pathFilter` SQL into a shared helper parameterized by column expression. `@sce/retrieval` adds `AstRetrievalStrategy` (direct scoring from `matchType`, no `SimpleRanker`); `KeywordRetrievalStrategy`/`SemanticRetrievalStrategy`/`HybridRetrievalStrategy` reject `symbolKind`. `@sce/indexing` writes/prunes symbols alongside chunks. `@sce/runtime` always wires `astStrategy`. CLI adds `--mode ast` + `--symbol-kind`; MCP adds `mode: "ast"` + `symbolKind`.

**Tech Stack:** TypeScript, Node.js 20+, npm workspaces, Vitest, `better-sqlite3`, `zod`, existing `commander` / `@modelcontextprotocol/sdk` adapters. No new dependencies.

## Global Constraints

- Work only on branch `develop`. Do not commit to `main` (production-only). Do not push. No PR.
- Markdown behavior stays byte-for-byte unchanged: default `indexing.include` stays `["**/*.md"]`; `MarkdownChunker` unmodified; existing tests stay green.
- Pasttime must remain untouched.
- No new `sce.config.json` keys. AST is always wired (no config gate).
- The `symbols` table is a write-aside; do NOT migrate the `chunks` table or persist `Chunk.symbolKind` through it. The `symbols` table is the source of truth for AST queries.
- `ISymbolIndex` is a core interface; `SqliteSymbolIndex` lives in `@sce/storage` and reuses the shared DB via `.attach(db)`. The strategy depends on `ISymbolIndex` (testable with stubs), not on storage.
- `pathFilter` SQL is extracted into a shared helper parameterized by column expression; both keyword (`chunks_fts.relative_path`) and AST (`symbols.relative_path`) use it. Preserve keyword's existing behavior exactly.
- The `text`-skip path (unsupported-language files) must NOT call `symbolIndex.removeSymbolsForFile` — `text`-language files never had symbols. Symbol cleanup happens on prune and re-index only.
- `SymbolHit.matchType` (`"exact" | "prefix"`) is set by `searchSymbols`; the strategy scores from it (`exact` → 1.0, `prefix` → `0.5 + matchedLength/nameLength`).
- Use TDD for each task. Run `npm test`, `npm run typecheck`, and `npm run build` green before each commit. Commit on `develop` after every task.
- Do not start implementation until the plan has been reviewed and you are explicitly asked.

## Non-Goals

- No call hierarchy, references, or inheritance (Slice 3).
- No AST-in-hybrid (Slice 4).
- No `qualified_name` as a query input (the column exists for ranking only this slice).
- No signature storage; `snippet` from chunk text is enough.
- No migration of the `chunks` table for `symbolKind` columns.
- No `Optimize()`/reconcile pass.
- No new embedding providers.
- No Pasttime coupling. No PR.

---

## File Structure

Create and modify this structure across the implementation:

```text
packages/core/src/interfaces/SymbolIndex.ts                         # Create: ISymbolIndex
packages/core/src/models/SymbolSearchQuery.ts                       # Create
packages/core/src/models/SymbolHit.ts                               # Create (with matchType)
packages/core/src/models/Search.ts                                  # Modify: add symbolKind? to SearchQuery + SearchHit
packages/core/src/api/SemanticContextEngine.ts                      # Modify: astStrategy dep, route ast, reject symbolKind on other modes
packages/core/src/api/SemanticContextEngine.test.ts                 # Modify: ast routing, symbolKind rejection
packages/core/src/index.ts                                          # Modify: export new types/interfaces

packages/storage/src/schema.ts                                      # Modify: add symbols table + indexes
packages/storage/src/SqliteSymbolIndex.ts                           # Create
packages/storage/src/pathFilter.ts                                  # Create: shared pathFilter helper (extracted from SqliteStorage)
packages/storage/src/SqliteStorage.ts                               # Modify: use shared pathFilter helper
packages/storage/src/__tests__/SqliteSymbolIndex.test.ts            # Create
packages/storage/src/index.ts                                       # Modify: export SqliteSymbolIndex

packages/retrieval/src/AstRetrievalStrategy.ts                      # Create
packages/retrieval/src/__tests__/AstRetrievalStrategy.test.ts       # Create
packages/retrieval/src/KeywordRetrievalStrategy.ts                  # Modify: reject symbolKind
packages/retrieval/src/SemanticRetrievalStrategy.ts                 # Modify: reject symbolKind
packages/retrieval/src/HybridRetrievalStrategy.ts                   # Modify: reject symbolKind
packages/retrieval/src/index.ts                                     # Modify: export AstRetrievalStrategy

packages/indexing/src/Indexer.ts                                    # Modify: write/prune symbols
packages/indexing/src/__tests__/Indexer.test.ts                     # Modify: symbol index write/prune tests
packages/indexing/package.json                                      # Modify: depends on @sce/storage? No — ISymbolIndex is core.

packages/runtime/src/createEngine.ts                                # Modify: always wire astStrategy + symbolIndex
packages/runtime/src/__tests__/createEngine.test.ts                 # Modify: AST always wired integration

packages/cli/src/main.ts                                            # Modify: --mode ast + --symbol-kind
packages/cli/src/__tests__/main.test.ts                             # Modify: ast mode + symbolKind test

packages/mcp/src/server.ts                                          # Modify: add "ast" + symbolKind to sce_search schema
packages/mcp/src/tools.ts                                           # Modify: accept mode "ast" + symbolKind
packages/mcp/src/__tests__/tools.test.ts                            # Modify: ast mode test

README.md                                                           # Modify: document mode ast + --symbol-kind
HANDOFF.md                                                          # Modify: mark AST lookup shipped + follow-ups

docs/superpowers/specs/2026-07-13-sce-ast-symbol-lookup-slice-design.md  # No change (source of truth)
```

Responsibilities:
- `ISymbolIndex`: write/query surface for symbols. `indexSymbols` skips chunks without `symbolKind`.
- `SymbolHit`: carries `matchType` so the strategy can score.
- `SqliteSymbolIndex`: SQLite impl reusing the shared DB; tiered exact-then-prefix with `matchType` tagging; SQL-level filters; ranking via `ORDER BY`.
- `pathFilter.ts`: shared `buildPathFilterClause(pathFilter, columnExpr)` + `escapeLike`, extracted from `SqliteStorage`.
- `AstRetrievalStrategy`: validates `text`, calls `searchSymbols`, scores from `matchType`, hydrates via `getChunks`, shapes `SearchHit` with `symbolKind`.
- `Indexer`: writes symbols after `indexChunks`; prunes on file delete; does NOT touch symbols on `text`-skip.
- `createEngine`: always constructs `SqliteSymbolIndex` + `AstRetrievalStrategy` + injects `astStrategy` and `symbolIndex` into the indexer.

---

## Task 1: Core models and `ISymbolIndex` interface

**Files:**
- Create: `packages/core/src/interfaces/SymbolIndex.ts`
- Create: `packages/core/src/models/SymbolSearchQuery.ts`
- Create: `packages/core/src/models/SymbolHit.ts`
- Modify: `packages/core/src/models/Search.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Chunk`, `SymbolKind`.
- Produces: `ISymbolIndex`, `SymbolSearchQuery`, `SymbolHit` (with `matchType`), `SearchQuery.symbolKind?`, `SearchHit.symbolKind?`. Later tasks import these from `@sce/core`.

- [ ] **Step 1: Add `symbolKind` to `SearchQuery` and `SearchHit`**

Modify `packages/core/src/models/Search.ts`. Add the import and two optional fields:

```ts
import type { SymbolKind } from "./SymbolKind.js";
```

Add to `SearchQuery` (after `language?: string;`):
```ts
  symbolKind?: SymbolKind;
```

Add to `SearchHit` (after `headingPath?: string[];`):
```ts
  symbolKind?: SymbolKind;
```

- [ ] **Step 2: Create `SymbolSearchQuery` and `SymbolHit` models**

Create `packages/core/src/models/SymbolSearchQuery.ts`:
```ts
import type { SymbolKind } from "./SymbolKind.js";

export interface SymbolSearchQuery {
  name: string;
  symbolKind?: SymbolKind;
  repositoryIds?: string[];
  pathFilter?: string;
  language?: string;
  limit: number;
}
```

Create `packages/core/src/models/SymbolHit.ts`:
```ts
import type { SymbolKind } from "./SymbolKind.js";

export interface SymbolHit {
  chunkId: string;
  symbolKind: SymbolKind;
  name: string;
  qualifiedName: string;
  relativePath: string;
  matchType: "exact" | "prefix";
}
```

- [ ] **Step 3: Create the `ISymbolIndex` interface**

Create `packages/core/src/interfaces/SymbolIndex.ts`:
```ts
import type { Chunk } from "../models/Chunk.js";
import type { SymbolHit } from "../models/SymbolHit.js";
import type { SymbolSearchQuery } from "../models/SymbolSearchQuery.js";

export interface ISymbolIndex {
  indexSymbols(chunks: Chunk[]): Promise<void>;
  removeSymbolsForFile(repositoryId: string, relativePath: string): Promise<void>;
  deleteByRepository(repositoryId: string): Promise<void>;
  searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]>;
}
```

- [ ] **Step 4: Export from `@sce/core`**

Modify `packages/core/src/index.ts` — add exports alongside the existing model/interface exports:
```ts
export * from "./interfaces/SymbolIndex.js";
export * from "./models/SymbolSearchQuery.js";
export * from "./models/SymbolHit.js";
```

- [ ] **Step 5: Run typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. No behavior change yet (fields are optional; interface is unused).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/interfaces/SymbolIndex.ts packages/core/src/models/SymbolSearchQuery.ts packages/core/src/models/SymbolHit.ts packages/core/src/models/Search.ts packages/core/src/index.ts
git commit -m "feat(core): add ISymbolIndex interface and symbolKind on SearchQuery/SearchHit"
```

---

## Task 2: Extract shared `pathFilter` helper in `@sce/storage`

**Files:**
- Create: `packages/storage/src/pathFilter.ts`
- Create: `packages/storage/src/__tests__/pathFilter.test.ts`
- Modify: `packages/storage/src/SqliteStorage.ts`

**Interfaces:**
- Consumes: the existing `buildPathFilterClause` + `escapeLike` in `SqliteStorage.ts` (hardcoded to `chunks_fts.relative_path`).
- Produces: `buildPathFilterClause(pathFilter: string, columnExpr: string): { sql: string; params: unknown[] }` and `escapeLike(value: string): string` in a shared `pathFilter.ts`. `SqliteStorage` calls `buildPathFilterClause(pathFilter, "chunks_fts.relative_path")`. Task 4's `SqliteSymbolIndex` calls `buildPathFilterClause(pathFilter, "symbols.relative_path")`.

- [ ] **Step 1: Write failing tests for the shared helper**

Create `packages/storage/src/__tests__/pathFilter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildPathFilterClause, escapeLike } from "../pathFilter.js";

describe("buildPathFilterClause", () => {
  it("returns undefined when pathFilter is undefined/empty", () => {
    expect(buildPathFilterClause(undefined, "t.col")).toBeUndefined();
    expect(buildPathFilterClause("", "t.col")).toBeUndefined();
  });

  it("uses GLOB when the filter has glob chars", () => {
    const clause = buildPathFilterClause("*.md", "t.col")!;
    expect(clause.sql).toBe("t.col GLOB ?");
    expect(clause.params).toEqual(["*.md"]);
  });

  it("uses exact OR prefix-LIKE for non-glob filters, against the given column", () => {
    const clause = buildPathFilterClause("notes/foo", "symbols.relative_path")!;
    expect(clause.sql).toBe("(symbols.relative_path = ? OR symbols.relative_path LIKE ? ESCAPE '\\')");
    expect(clause.params).toEqual(["notes/foo", "notes/foo/%"]);
  });

  it("escapes LIKE metacharacters in the prefix", () => {
    const clause = buildPathFilterClause("a_b%c", "t.col")!;
    expect(clause.params[1]).toBe("a\\_b\\%c/%");
  });
});

describe("escapeLike", () => {
  it("escapes backslash, percent, underscore", () => {
    expect(escapeLike("a_b%c\\d")).toBe("a\\_b\\%c\\\\d");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/storage/src/__tests__/pathFilter.test.ts`
Expected: FAIL — module `../pathFilter.js` not found.

- [ ] **Step 3: Create the shared helper**

Create `packages/storage/src/pathFilter.ts`:
```ts
export function buildPathFilterClause(
  pathFilter: string | undefined,
  columnExpr: string
): { sql: string; params: unknown[] } | undefined {
  if (!pathFilter) return undefined;
  if (/[*?]/.test(pathFilter)) {
    return { sql: `${columnExpr} GLOB ?`, params: [pathFilter] };
  }
  return {
    sql: `(${columnExpr} = ? OR ${columnExpr} LIKE ? ESCAPE '\\')`,
    params: [pathFilter, `${escapeLike(pathFilter)}/%`]
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
```

- [ ] **Step 4: Refactor `SqliteStorage` to use the shared helper**

Modify `packages/storage/src/SqliteStorage.ts`:
1. Add the import at the top: `import { buildPathFilterClause, escapeLike } from "./pathFilter.js";`
2. Update the call site (around line 205) to pass the column: `const pathClause = buildPathFilterClause(query.pathFilter, "chunks_fts.relative_path");`
3. **Delete** the local `buildPathFilterClause` and `escapeLike` function definitions at the bottom of the file (they're now imported).

Verify the existing keyword search tests still pass — this is a pure refactor (extract + parameterize), no behavior change.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/storage/src/__tests__/pathFilter.test.ts packages/storage/src/__tests__/SqliteStorage.test.ts`
Expected: PASS — new helper tests + existing keyword tests green (refactor preserved behavior).

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/storage/src/pathFilter.ts packages/storage/src/__tests__/pathFilter.test.ts packages/storage/src/SqliteStorage.ts
git commit -m "refactor(storage): extract shared pathFilter helper"
```

---

## Task 3: `symbols` table schema

**Files:**
- Modify: `packages/storage/src/schema.ts`

**Interfaces:**
- Consumes: existing `createSchemaSql`.
- Produces: a `symbols` table + indexes, created via `CREATE TABLE IF NOT EXISTS` so existing DBs get it on next open.

- [ ] **Step 1: Add the `symbols` table and indexes to `createSchemaSql`**

Modify `packages/storage/src/schema.ts` — append inside `createSchemaSql` (after the `vectors` table block):

```sql

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  symbol_kind TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbols_repo_name ON symbols (repository_id, name);
CREATE INDEX IF NOT EXISTS idx_symbols_repo_kind_name ON symbols (repository_id, symbol_kind, name);
CREATE INDEX IF NOT EXISTS idx_symbols_repo_path ON symbols (repository_id, relative_path);
```

- [ ] **Step 2: Run typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. Existing storage tests still pass (the table is created on open; no behavior change).

- [ ] **Step 3: Commit**

```bash
git add packages/storage/src/schema.ts
git commit -m "feat(storage): add symbols table schema"
```

---

## Task 4: `SqliteSymbolIndex` — write methods

**Files:**
- Create: `packages/storage/src/SqliteSymbolIndex.ts`
- Modify: `packages/storage/src/index.ts`
- Create: `packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`

**Interfaces:**
- Consumes: `ISymbolIndex`, `Chunk`, `SymbolKind` from `@sce/core`; the shared DB `Database` handle; the `symbols` table from Task 3.
- Produces: `SqliteSymbolIndex` constructed via `SqliteSymbolIndex.attach(db)`. `indexSymbols(chunks)` inserts one row per chunk that has a `symbolKind` (skips chunks without one); `removeSymbolsForFile` deletes by `(repository_id, relative_path)`; `deleteByRepository` deletes by `repository_id`. (`searchSymbols` is Task 5.)

- [ ] **Step 1: Write failing tests for the write methods**

Create `packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`:
```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { SqliteStorage } from "../SqliteStorage.js";
import { SqliteSymbolIndex } from "../SqliteSymbolIndex.js";
import type { Chunk } from "@sce/core";

async function openIndex(dir: string) {
  const storage = await SqliteStorage.open(dir);
  const index = SqliteSymbolIndex.attach(storage.getDatabase());
  return { storage, index };
}

function makeChunk(overrides: Partial<Chunk> & { id: string; repositoryId: string; relativePath: string }): Chunk {
  return {
    language: "typescript",
    startLine: 1,
    endLine: 3,
    text: "function foo() {}",
    fileHash: "h",
    timestamp: new Date("2026-07-13T00:00:00.000Z"),
    headingPath: ["foo"],
    ...overrides
  } as Chunk;
}

describe("SqliteSymbolIndex writes", () => {
  it("indexSymbols inserts rows only for chunks with a symbolKind", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      const { index } = await openIndex(dir);
      storage = (await openIndex(dir)).storage; // reuse below instead
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});
```

**Note for the implementer:** the scaffolding above is a starting point — model your final tests on the existing `SqliteVectorStore.test.ts` pattern (one `openStores` helper that opens storage + attaches the index, used across `it` blocks). Write these cases:
1. `indexSymbols` with a mix of chunks (some with `symbolKind`, some without — e.g. a Markdown chunk and a zero-declaration fallback chunk with no `symbolKind`): only the `symbolKind`-bearing chunks get rows; `qualified_name` = `headingPath.join("/")`.
2. `indexSymbols` is a replace for the file: call `indexSymbols([a, b])` for `(repo, "f.ts")`, then `indexSymbols([c])` for the same file → only `c` remains (but note: the indexer calls `removeSymbolsForFile` before `indexSymbols`, so test that sequence too).
3. `removeSymbolsForFile` deletes only that file's rows.
4. `deleteByRepository` deletes all rows for a repo.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`
Expected: FAIL — module `../SqliteSymbolIndex.js` not found.

- [ ] **Step 3: Implement `SqliteSymbolIndex` (write methods only; `searchSymbols` stubbed to return `[]` for now)**

Create `packages/storage/src/SqliteSymbolIndex.ts`:
```ts
import type { Database } from "better-sqlite3";
import type { Chunk, ISymbolIndex, SymbolHit, SymbolSearchQuery } from "@sce/core";

export class SqliteSymbolIndex implements ISymbolIndex {
  constructor(private readonly db: Database.Database) {}

  static attach(db: Database.Database): SqliteSymbolIndex {
    return new SqliteSymbolIndex(db);
  }

  async indexSymbols(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const insert = this.db.prepare(
      `INSERT INTO symbols (chunk_id, repository_id, relative_path, language, symbol_kind, name, qualified_name)
       VALUES (@chunkId, @repositoryId, @relativePath, @language, @symbolKind, @name, @qualifiedName)`
    );
    const tx = this.db.transaction((rows: Row[]) => {
      for (const row of rows) insert.run(row);
    });
    const rows: Row[] = chunks
      .filter((c) => c.symbolKind !== undefined)
      .map((c) => ({
        chunkId: c.id,
        repositoryId: c.repositoryId,
        relativePath: c.relativePath,
        language: c.language,
        symbolKind: c.symbolKind!,
        name: c.headingPath?.at(-1) ?? "",
        qualifiedName: (c.headingPath ?? []).join("/")
      }))
      .filter((r) => r.name.length > 0); // skip unnamed (defensive)
    if (rows.length === 0) return;
    tx(rows);
  }

  async removeSymbolsForFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db
      .prepare("DELETE FROM symbols WHERE repository_id = ? AND relative_path = ?")
      .run(repositoryId, relativePath);
  }

  async deleteByRepository(repositoryId: string): Promise<void> {
    this.db.prepare("DELETE FROM symbols WHERE repository_id = ?").run(repositoryId);
  }

  async searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]> {
    // Implemented in Task 5.
    return [];
  }
}

interface Row {
  chunkId: string;
  repositoryId: string;
  relativePath: string;
  language: string;
  symbolKind: string;
  name: string;
  qualifiedName: string;
}
```

Modify `packages/storage/src/index.ts` — add: `export * from "./SqliteSymbolIndex.js";`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/storage/src/SqliteSymbolIndex.ts packages/storage/src/__tests__/SqliteSymbolIndex.test.ts packages/storage/src/index.ts
git commit -m "feat(storage): add SqliteSymbolIndex with write methods"
```

---

## Task 5: `SqliteSymbolIndex.searchSymbols` — tiered exact-then-prefix

**Files:**
- Modify: `packages/storage/src/SqliteSymbolIndex.ts`
- Modify: `packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`

**Interfaces:**
- Consumes: `SymbolSearchQuery`, `SymbolHit`, the shared `buildPathFilterClause` (Task 2), the `symbols` table (Task 3).
- Produces: `searchSymbols` runs the exact tier (`name = ? COLLATE NOCASE` + filters + ranking); if empty, runs the prefix tier (`name LIKE ?% COLLATE NOCASE` + filters + ranking); tags each hit with `matchType`. Ranking `ORDER BY length(qualified_name) ASC, symbol_kind_priority, name ASC, chunk_id ASC` where `symbol_kind_priority` = CASE(`class`/`interface`/`type`/`enum`/`namespace`→0, `function`/`arrow`/`function-expr`→1, `method`→2). SQL-level `repositoryIds`/`pathFilter`/`language`/`symbolKind` filters. Empty `name` → `[]`.

- [ ] **Step 1: Write failing tests for `searchSymbols`**

Append to `packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`. Cases (build on the existing `openIndex` helper from Task 4):
1. Exact match (case-insensitive): insert `Widget` (class), search `name: "widget"` → 1 hit, `matchType: "exact"`.
2. Prefix fallback: insert `render`, `renderView`; search `name: "rend"` (no exact) → 2 hits, `matchType: "prefix"`, both returned.
3. No prefix when exact exists: insert `render`, `renderView`; search `name: "render"` (exact exists) → only `render`, `matchType: "exact"`; `renderView` is NOT returned.
4. `symbolKind` filter narrows: insert `Widget` (class) + `Widget` (method, different chunk); search `name: "Widget", symbolKind: "class"` → only the class hit.
5. Duplicate-name ranking: insert a class `Foo` (qualified_name `Foo`), a method `Foo` (qualified_name `Bar/Foo`); search `name: "foo"` → class first (shorter `qualified_name` + kind priority 0), method second.
6. `repositoryIds` filter: insert symbols for `repo-a` and `repo-b`; search with `repositoryIds: ["repo-a"]` → only `repo-a` rows.
7. `pathFilter` exact (non-glob): insert `src/a.ts`, `src/b.ts`; search `pathFilter: "src/a.ts"` → only `a.ts`.
8. `pathFilter` GLOB: search `pathFilter: "src/*.ts"` → both.
9. `language` filter: insert a `typescript` and a `javascript` row with the same name; search `language: "javascript"` → only the JS row.
10. Empty `name` → `[]`.
11. `limit` respected: insert 5 exact matches; search `limit: 2` → 2 hits.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`
Expected: FAIL — `searchSymbols` returns `[]` for all cases.

- [ ] **Step 3: Implement `searchSymbols`**

Replace the stubbed `searchSymbols` in `packages/storage/src/SqliteSymbolIndex.ts`:
```ts
  async searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]> {
    if (!query.name || query.name.trim().length === 0) return [];
    const limit = query.limit;

    const exact = this.runTier(query, "exact", limit);
    if (exact.length > 0) return exact.slice(0, limit);
    const prefix = this.runTier(query, "prefix", limit);
    return prefix.slice(0, limit);
  }

  private runTier(query: SymbolSearchQuery, matchType: "exact" | "prefix", limit: number): SymbolHit[] {
    const where: string[] = [];
    const params: unknown[] = [];

    if (matchType === "exact") {
      where.push("name = ? COLLATE NOCASE");
      params.push(query.name);
    } else {
      where.push("name LIKE ? COLLATE NOCASE");
      params.push(`${query.name}%`);
    }

    if (query.symbolKind) {
      where.push("symbol_kind = ?");
      params.push(query.symbolKind);
    }
    if (query.language) {
      where.push("language = ?");
      params.push(query.language);
    }
    if (query.repositoryIds && query.repositoryIds.length > 0) {
      where.push(`repository_id IN (${query.repositoryIds.map(() => "?").join(", ")})`);
      params.push(...query.repositoryIds);
    }
    const pathClause = buildPathFilterClause(query.pathFilter, "symbols.relative_path");
    if (pathClause) {
      where.push(pathClause.sql);
      params.push(...pathClause.params);
    }

    const sql = `
      SELECT chunk_id, symbol_kind, name, qualified_name, relative_path
      FROM symbols
      WHERE ${where.join(" AND ")}
      ORDER BY
        length(qualified_name) ASC,
        CASE symbol_kind
          WHEN 'class' THEN 0 WHEN 'interface' THEN 0 WHEN 'type' THEN 0 WHEN 'enum' THEN 0 WHEN 'namespace' THEN 0
          WHEN 'function' THEN 1 WHEN 'arrow' THEN 1 WHEN 'function-expr' THEN 1
          WHEN 'method' THEN 2
          ELSE 3
        END,
        name ASC,
        chunk_id ASC
      LIMIT ?
    `;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as SymbolRow[];
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      symbolKind: row.symbol_kind as SymbolHit["symbolKind"],
      name: row.name,
      qualifiedName: row.qualified_name,
      relativePath: row.relative_path,
      matchType
    }));
  }
```

Add the imports at the top: `import { buildPathFilterClause } from "./pathFilter.js";` and add the `SymbolRow` interface at the bottom:
```ts
interface SymbolRow {
  chunk_id: string;
  symbol_kind: string;
  name: string;
  qualified_name: string;
  relative_path: string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/storage/src/__tests__/SqliteSymbolIndex.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/storage/src/SqliteSymbolIndex.ts packages/storage/src/__tests__/SqliteSymbolIndex.test.ts
git commit -m "feat(storage): SqliteSymbolIndex tiered searchSymbols with matchType"
```

---

## Task 6: `AstRetrievalStrategy`

**Files:**
- Create: `packages/retrieval/src/AstRetrievalStrategy.ts`
- Create: `packages/retrieval/src/__tests__/AstRetrievalStrategy.test.ts`
- Modify: `packages/retrieval/src/index.ts`

**Interfaces:**
- Consumes: `IRetrievalStrategy`, `SearchHit`, `SearchQuery`, `SearchResult`, `ISymbolIndex`, `IMetadataStore`, `Chunk`, `SymbolHit` from `@sce/core`.
- Produces: `AstRetrievalStrategy` constructor `(deps: { symbolIndex: ISymbolIndex; metadataStore: IMetadataStore; defaultLimit: number; maxSnippetChars: number })`. `name = "ast"`. Later tasks inject it as `astStrategy` in core and runtime.

- [ ] **Step 1: Write failing tests**

Create `packages/retrieval/src/__tests__/AstRetrievalStrategy.test.ts`. Cases (use stub `ISymbolIndex` + stub `IMetadataStore`):
1. Rejects empty `text` with `/AST search requires a non-empty symbol name/`.
2. Rejects whitespace-only `text`.
3. Exact match: stub returns `[{ chunkId: "c1", symbolKind: "class", name: "Widget", qualifiedName: "Widget", relativePath: "a.ts", matchType: "exact" }]`; metadataStore returns a chunk; result hit has `score: 1.0`, `strategy: "ast"`, `symbolKind: "class"`, `headingPath` from chunk.
4. Prefix match: stub returns a hit with `matchType: "prefix"`, name `renderView`; query `text: "rend"`; score `0.5 + 4/10 = 0.9`.
5. `symbolKind`/`repositoryIds`/`pathFilter`/`language` forwarded to `searchSymbols` (spy on the call).
6. Missing chunk on hydrate (metadataStore returns `[]`): hit dropped, result empty.
7. `limit` respected (query.limit) and `defaultLimit` used when omitted.
8. `diagnostics.strategy === "ast"`, `scannedChunks` = unique chunk ids before slice, `elapsedMs` present.

Look at `SemanticRetrievalStrategy.test.ts` for the stub pattern (stub `IMetadataStore` with `getChunks: async (ids) => [...]`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/retrieval/src/__tests__/AstRetrievalStrategy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the strategy**

Create `packages/retrieval/src/AstRetrievalStrategy.ts`:
```ts
import type {
  Chunk,
  IMetadataStore,
  ISymbolIndex,
  IRetrievalStrategy,
  SearchHit,
  SearchQuery,
  SearchResult,
  SymbolHit
} from "@sce/core";

export interface AstRetrievalStrategyDeps {
  symbolIndex: ISymbolIndex;
  metadataStore: IMetadataStore;
  defaultLimit: number;
  maxSnippetChars: number;
}

export class AstRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "ast" as const;

  constructor(private readonly deps: AstRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    if (!query.text || query.text.trim().length === 0) {
      throw new Error("AST search requires a non-empty symbol name");
    }

    const start = performance.now();
    const limit = query.limit ?? this.deps.defaultLimit;

    const symbolHits = await this.deps.symbolIndex.searchSymbols({
      name: query.text,
      ...(query.symbolKind ? { symbolKind: query.symbolKind } : {}),
      ...(query.repositoryIds ? { repositoryIds: query.repositoryIds } : {}),
      ...(query.pathFilter ? { pathFilter: query.pathFilter } : {}),
      ...(query.language ? { language: query.language } : {}),
      limit
    });

    if (symbolHits.length === 0) {
      return { hits: [], diagnostics: { strategy: "ast", elapsedMs: Math.round(performance.now() - start), scannedChunks: 0 } };
    }

    const chunks = await this.deps.metadataStore.getChunks(symbolHits.map((h) => h.chunkId));
    const byId = new Map(chunks.map((c) => [c.id, c] as const));

    const hits: SearchHit[] = [];
    for (const sh of symbolHits) {
      const chunk = byId.get(sh.chunkId);
      if (!chunk) continue; // defensive: drop missing chunks
      hits.push({
        chunkId: chunk.id,
        score: scoreFromMatchType(sh, query.text),
        strategy: "ast",
        snippet: truncate(chunk.text, this.deps.maxSnippetChars),
        path: chunk.relativePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        ...(chunk.headingPath && chunk.headingPath.length > 0 ? { headingPath: chunk.headingPath } : {}),
        symbolKind: sh.symbolKind
      });
    }

    // symbolHits already came back in ranking order from SQL; preserve it.
    const sliced = hits.slice(0, limit);

    return {
      hits: sliced,
      diagnostics: {
        strategy: "ast",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: new Set(symbolHits.map((h) => h.chunkId)).size
      }
    };
  }
}

function scoreFromMatchType(hit: SymbolHit, queryText: string): number {
  if (hit.matchType === "exact") return 1.0;
  const matchedLength = queryText.length;
  const nameLength = hit.name.length;
  if (nameLength === 0) return 0.5;
  return 0.5 + matchedLength / nameLength;
}

function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const limit = Math.max(0, maxChars);
  if (flat.length <= limit) return flat;
  if (limit <= 3) return flat.slice(0, limit);
  return `${flat.slice(0, limit - 3)}...`;
}
```

Modify `packages/retrieval/src/index.ts` — add: `export * from "./AstRetrievalStrategy.js";`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/retrieval/src/__tests__/AstRetrievalStrategy.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/retrieval/src/AstRetrievalStrategy.ts packages/retrieval/src/__tests__/AstRetrievalStrategy.test.ts packages/retrieval/src/index.ts
git commit -m "feat(retrieval): add AstRetrievalStrategy"
```

---

## Task 7: `symbolKind` rejection on keyword/semantic/hybrid strategies

**Files:**
- Modify: `packages/retrieval/src/KeywordRetrievalStrategy.ts`
- Modify: `packages/retrieval/src/SemanticRetrievalStrategy.ts`
- Modify: `packages/retrieval/src/HybridRetrievalStrategy.ts`
- Modify: existing retrieval tests as needed to cover the rejection

**Interfaces:**
- Consumes: `SearchQuery.symbolKind?`.
- Produces: keyword/semantic/hybrid throw `"symbolKind is not supported in <mode> mode"` when `query.symbolKind` is present.

- [ ] **Step 1: Write failing tests for the rejections**

Add one test per strategy (in each strategy's existing test file) asserting `symbolKind` rejection:
```ts
  it("rejects symbolKind with a clear unsupported-filter error", async () => {
    const strategy = /* construct as in other tests */;
    await expect(strategy.search({ text: "x", symbolKind: "class" })).rejects.toThrow(
      /symbolKind.*<mode>|<mode>.*symbolKind/i
    );
  });
```
Replace `<mode>` with `keyword`/`semantic`/`hybrid` respectively.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/retrieval/src/__tests__/KeywordRetrievalStrategy.test.ts packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts`
Expected: FAIL — the new tests fail (no rejection yet).

- [ ] **Step 3: Add the rejection guard to each strategy**

In each of `KeywordRetrievalStrategy.ts`, `SemanticRetrievalStrategy.ts`, `HybridRetrievalStrategy.ts`, add as the **first** statement of `search(query)`:
```ts
    if (query.symbolKind !== undefined) {
      throw new Error("symbolKind is not supported in <mode> mode");
    }
```
Replace `<mode>` with `keyword`/`semantic`/`hybrid` respectively. For `HybridRetrievalStrategy`, place the guard alongside the existing `pathFilter`/`language` guards (which throw first); order: `pathFilter`, `language`, `symbolKind`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/retrieval/src/__tests__/KeywordRetrievalStrategy.test.ts packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/retrieval/src/KeywordRetrievalStrategy.ts packages/retrieval/src/SemanticRetrievalStrategy.ts packages/retrieval/src/HybridRetrievalStrategy.ts packages/retrieval/src/__tests__/
git commit -m "feat(retrieval): reject symbolKind on keyword/semantic/hybrid modes"
```

---

## Task 8: Core routing for AST mode + `symbolKind` rejection on `search()`

**Files:**
- Modify: `packages/core/src/api/SemanticContextEngine.ts`
- Modify: `packages/core/src/api/SemanticContextEngine.test.ts`

**Interfaces:**
- Consumes: `IRetrievalStrategy`, `SearchQuery`, `SearchResult`.
- Produces: `SemanticContextEngineDeps` gains optional `astStrategy?: IRetrievalStrategy`. `search({ mode: "ast" })` and `astSearch()` route to `astStrategy` with `mode: "ast"`, or throw `"AST search is not configured"` when absent. The existing `"Search mode ast is not implemented in v1"` error is removed. `search()` itself does NOT reject `symbolKind` for `mode: "ast"` (AST uses it); the per-strategy rejection (Task 7) handles non-AST modes.

- [ ] **Step 1: Write failing tests for AST routing**

Append to `packages/core/src/api/SemanticContextEngine.test.ts`:
```ts
describe("SemanticContextEngine ast routing", () => {
  it("routes ast mode to the ast strategy when configured", async () => {
    const calls: SearchQuery[] = [];
    const ast: IRetrievalStrategy = {
      name: "ast",
      search: async (query) => {
        calls.push(query);
        return { hits: [{ chunkId: "a1", score: 1, strategy: "ast", snippet: "class Widget", path: "W.ts", startLine: 1, endLine: 3, symbolKind: "class" }], diagnostics: { strategy: "ast" } };
      }
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      astStrategy: ast
    });
    const result = await engine.search({ text: "Widget", mode: "ast", symbolKind: "class" });
    expect(result.hits[0]?.chunkId).toBe("a1");
    expect(calls[0]?.mode).toBe("ast");
    expect(calls[0]?.symbolKind).toBe("class");
  });

  it("astSearch() delegates to the ast strategy with mode 'ast'", async () => {
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      astStrategy: { name: "ast", search: async () => ({ hits: [], diagnostics: { strategy: "ast" } }) }
    });
    const result = await engine.astSearch({ text: "Widget" });
    expect(result.diagnostics?.strategy).toBe("ast");
  });

  it("throws a clear error when ast is requested but not configured", async () => {
    const engine = new SemanticContextEngine({ keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) } });
    await expect(engine.search({ text: "Widget", mode: "ast" })).rejects.toThrow(/AST search is not configured/);
    await expect(engine.astSearch({ text: "Widget" })).rejects.toThrow(/AST search is not configured/);
  });
});
```

Also **update** the existing test that asserts ast throws "not implemented in v1":
```ts
  it("rejects ast as unimplemented and hybrid as not-configured when no hybrid strategy is wired", async () => {
```
The current test asserts `engine.search({ text: "x", mode: "ast" })` throws `/Search mode ast is not implemented in v1/`. Change that assertion to `/AST search is not configured/` (ast now routes and reports not-configured when no `astStrategy`). Keep the hybrid assertion unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: FAIL — ast still throws "not implemented in v1"; `astSearch` is unsupported.

- [ ] **Step 3: Wire AST routing into the engine**

Modify `packages/core/src/api/SemanticContextEngine.ts`:
1. Add `astStrategy?: IRetrievalStrategy;` to `SemanticContextEngineDeps` (after `hybridStrategy?`).
2. Update `search`:
```ts
  async search(query: SearchQuery): Promise<SearchResult> {
    const mode = query.mode ?? "keyword";
    if (mode === "keyword") return this.keywordSearch(query);
    if (mode === "semantic") return this.semanticSearch(query);
    if (mode === "hybrid") return this.hybridSearch(query);
    if (mode === "ast") return this.astSearch(query);
    return this.unsupported(mode, query);
  }
```
3. Replace the `astSearch` body:
```ts
  async astSearch(query: SearchQuery): Promise<SearchResult> {
    if (!this.deps.astStrategy) {
      throw new Error("AST search is not configured");
    }
    return this.deps.astStrategy.search({ ...query, mode: "ast" });
  }
```
Leave `keywordSearch`/`semanticSearch`/`hybridSearch`/`unsupported` unchanged. (`SearchMode` already includes `"ast"`; `unsupported` now only fires for genuinely unknown modes, but since `SearchMode` is a closed union, it's effectively unreachable — keep it as a safety net.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api/SemanticContextEngine.ts packages/core/src/api/SemanticContextEngine.test.ts
git commit -m "feat(core): route ast search to an injected astStrategy"
```

---

## Task 9: Indexer writes and prunes symbols

**Files:**
- Modify: `packages/indexing/src/Indexer.ts`
- Modify: `packages/indexing/src/__tests__/Indexer.test.ts`

**Interfaces:**
- Consumes: `ISymbolIndex` from `@sce/core`; `Chunk`.
- Produces: `IndexingServiceDeps` gains optional `symbolIndex?: ISymbolIndex`. On file index/reindex (after `indexChunks`): `removeSymbolsForFile` then `indexSymbols(chunks)`. On prune: `removeSymbolsForFile`. The `text`-skip path does NOT touch symbols.

- [ ] **Step 1: Write failing tests**

Append to `packages/indexing/src/__tests__/Indexer.test.ts`. Use a stub `ISymbolIndex` that records calls:
1. On indexing a `.ts` file: `removeSymbolsForFile(repoId, relPath)` then `indexSymbols(chunks)` are called, in that order, after `indexChunks`. `indexSymbols` receives the chunks (the stub can assert it received chunks with `symbolKind`).
2. On prune (a previously-indexed `.ts` file removed from `include`): `removeSymbolsForFile` is called for that file.
3. On indexing a `.json` (text-skip) file: `removeSymbolsForFile` and `indexSymbols` are **NOT** called for that file (text-skip doesn't touch symbols).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/indexing/src/__tests__/Indexer.test.ts`
Expected: FAIL — indexer doesn't call `symbolIndex` yet.

- [ ] **Step 3: Wire the symbol index into the indexer**

Modify `packages/indexing/src/Indexer.ts`:
1. Add `symbolIndex?: ISymbolIndex;` to `IndexingServiceDeps` (import `ISymbolIndex` from `@sce/core`).
2. In the per-file index/reindex block, after `await this.deps.keywordIndex.indexChunks(chunks);` and before the embedding block, add:
```ts
      if (this.deps.symbolIndex) {
        await this.deps.symbolIndex.removeSymbolsForFile(repositoryId, relativePath);
        await this.deps.symbolIndex.indexSymbols(chunks);
      }
```
3. In the prune block (deleted files), after `this.deps.keywordIndex.removeChunksForFile(...)`, add:
```ts
      if (this.deps.symbolIndex) await this.deps.symbolIndex.removeSymbolsForFile(repositoryId, record.relativePath);
```
4. **Do NOT** add any symbol-index call to the `text`-skip guard (text files never had symbols).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/indexing/src/__tests__/Indexer.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/indexing/src/Indexer.ts packages/indexing/src/__tests__/Indexer.test.ts
git commit -m "feat(indexing): write and prune symbols alongside chunks"
```

---

## Task 10: Runtime always wires `astStrategy` + `symbolIndex`

**Files:**
- Modify: `packages/runtime/src/createEngine.ts`
- Modify: `packages/runtime/src/__tests__/createEngine.test.ts`

**Interfaces:**
- Consumes: `SqliteSymbolIndex` from `@sce/storage`; `AstRetrievalStrategy` from `@sce/retrieval`; the existing `storage.getDatabase()`.
- Produces: `createEngine` always constructs `SqliteSymbolIndex.attach(storage.getDatabase())` + `AstRetrievalStrategy` and injects `astStrategy` into the engine and `symbolIndex` into the indexer. No config gate.

- [ ] **Step 1: Write failing tests**

Append to `packages/runtime/src/__tests__/createEngine.test.ts`:
```ts
describe("createEngine ast wiring", () => {
  it("always wires astStrategy (no config gate); astSearch on a code repo returns the symbol", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-ast-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/widget.ts"), "export class Widget {\n  render(): string { return 'widget'; }\n}\n");
      await writeFile(join(dir, "sce.config.json"), JSON.stringify({ indexing: { include: ["**/*.md", "**/*.ts"] } }));
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      const result = await created.engine.astSearch({ text: "Widget" });
      expect(result.hits.some((h) => h.path.endsWith("src/widget.ts") && h.symbolKind === "class" && h.headingPath?.[0] === "Widget")).toBe(true);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("astSearch on a Markdown-only repo returns empty results (not an error)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-ast-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      const result = await created.engine.astSearch({ text: "anything" });
      expect(result.hits).toEqual([]);
      expect(result.diagnostics?.strategy).toBe("ast");
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});
```
Ensure `mkdir` is imported (it may already be from the code-indexing integration test).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: FAIL — `astSearch` throws "AST search is not configured" (no `astStrategy` wired yet).

- [ ] **Step 3: Wire AST into `createEngine`**

Modify `packages/runtime/src/createEngine.ts`:
1. Update imports: add `AstRetrievalStrategy` to the `@sce/retrieval` import; add `SqliteSymbolIndex` to the `@sce/storage` import.
2. After `storage` is opened and `keywordStrategy` built, add (no config gate):
```ts
  const symbolIndex = SqliteSymbolIndex.attach(storage.getDatabase());
  const astStrategy = new AstRetrievalStrategy({
    symbolIndex,
    metadataStore: storage,
    defaultLimit: config.search.defaultLimit,
    maxSnippetChars: config.search.maxSnippetChars
  });
```
3. Pass `symbolIndex` into the `IndexingService` deps: `...(symbolIndex ? { symbolIndex } : {}),` (or unconditionally, since it's always constructed).
4. Pass `astStrategy` into the `SemanticContextEngine` deps: `...(astStrategy ? { astStrategy } : {}),` (or unconditionally).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/createEngine.ts packages/runtime/src/__tests__/createEngine.test.ts
git commit -m "feat(runtime): always wire AstRetrievalStrategy and SqliteSymbolIndex"
```

---

## Task 11: CLI `--mode ast` + `--symbol-kind`

**Files:**
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/__tests__/main.test.ts`

**Interfaces:**
- Consumes: `engine.search` from `@sce/runtime`; `SymbolKind` values.
- Produces: `sce search --mode ast --symbol-kind class` forwards `mode: "ast"` + `symbolKind: "class"` to `engine.search`. `--symbol-kind` validates against the 9 `SymbolKind` values (commander choices). `--symbol-kind` with `--mode keyword` surfaces the core error clearly (existing `catch`).

- [ ] **Step 1: Write failing tests**

Append to `packages/cli/src/__tests__/main.test.ts`:
```ts
  it("runs ast search and prints a symbol hit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-cli-ast-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/widget.ts"), "export class Widget {\n  render(): string { return 'widget'; }\n}\n");
      await writeFile(join(dir, "sce.config.json"), JSON.stringify({ indexing: { include: ["**/*.md", "**/*.ts"] } }));
      await run(["index", dir, "--type", "vault"]);
      log.mockClear();
      await run(["search", "Widget", "--path", dir, "--mode", "ast"]);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/widget\.ts.*score=/));
    } finally {
      await rmWithRetry(dir);
    }
  });

  it("surfaces a clear error for --symbol-kind with --mode keyword", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-cli-ast-"));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await run(["search", "x", "--path", dir, "--mode", "keyword", "--symbol-kind", "class"]);
      expect(err).toHaveBeenCalledWith(expect.stringMatching(/symbolKind.*keyword|keyword.*symbolKind/i));
    } finally {
      await rmWithRetry(dir);
    }
  });
```
Ensure `mkdir` is imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/cli/src/__tests__/main.test.ts`
Expected: FAIL — `--symbol-kind` not accepted; `--mode ast` coerced to keyword.

- [ ] **Step 3: Accept `--mode ast` and `--symbol-kind` in the CLI**

Modify `packages/cli/src/main.ts` in the `search` command:
1. Add the `--symbol-kind` option (with commander `choices` validation against the 9 kinds):
```ts
    .option("--symbol-kind <kind>", "restrict to a symbol kind (ast mode only)", undefined)
```
(Commander doesn't have a built-in `choices` on `.option`; use a manual validation in the action: if `options.symbolKind` is set and not one of the 9 kinds, `console.error` and return. Or use `.addOption(new Option(...).choices([...]))` — see how the project handles enums elsewhere. Simplest: validate in the action.)
2. Update the mode coercion to include `"ast"`:
```ts
        const mode: "keyword" | "semantic" | "hybrid" | "ast" =
          options.mode === "semantic" || options.mode === "hybrid" || options.mode === "ast" ? options.mode : "keyword";
```
3. Pass `symbolKind` into the `engine.search` call:
```ts
        const result = await engine.search({
          text: query,
          mode,
          limit,
          pathFilter: options.pathFilter,
          language: options.language,
          ...(options.symbolKind ? { symbolKind: options.symbolKind as SymbolKind } : {})
        });
```
Import `SymbolKind` type from `@sce/core` for the cast (or validate the string against the 9 values and cast).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/cli/src/__tests__/main.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/main.ts packages/cli/src/__tests__/main.test.ts
git commit -m "feat(cli): accept --mode ast and --symbol-kind"
```

---

## Task 12: MCP `sce_search` accepts `mode: "ast"` + `symbolKind`

**Files:**
- Modify: `packages/mcp/src/server.ts`
- Modify: `packages/mcp/src/tools.ts`
- Modify: `packages/mcp/src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `engine.search` from `@sce/runtime`.
- Produces: `sce_search` schema accepts `mode: "keyword" | "semantic" | "hybrid" | "ast"` and `symbolKind: z.enum([...9 values...]).optional()`; `sceSearch` forwards both.

- [ ] **Step 1: Write a failing test**

Append to `packages/mcp/src/__tests__/tools.test.ts`:
```ts
  it("returns a symbol hit for mode=ast", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-mcp-ast-"));
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(join(dir, "src/widget.ts"), "export class Widget {\n  render(): string { return 'widget'; }\n}\n");
      await writeFile(join(dir, "sce.config.json"), JSON.stringify({ indexing: { include: ["**/*.md", "**/*.ts"] } }));
      await sceIndexRepository({ path: dir, type: "vault" });
      const result = await sceSearch({ path: dir, query: "Widget", mode: "ast", symbolKind: "class" });
      expect(result.hits.some((h) => h.path.endsWith("src/widget.ts") && h.symbolKind === "class")).toBe(true);
    } finally {
      await rmWithRetry(dir);
    }
  });
```
Ensure `mkdir` is imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/mcp/src/__tests__/tools.test.ts`
Expected: FAIL — schema rejects `"ast"` and `symbolKind`; type doesn't include them.

- [ ] **Step 3: Accept `ast` + `symbolKind` in MCP**

Modify `packages/mcp/src/server.ts` — update the `sce_search` schema:
```ts
    mode: z.enum(["keyword", "semantic", "hybrid", "ast"]).optional(),
    symbolKind: z.enum(["function", "method", "arrow", "function-expr", "class", "interface", "type", "enum", "namespace"]).optional(),
```

Modify `packages/mcp/src/tools.ts` — widen the `sceSearch` input type:
```ts
  mode?: "keyword" | "semantic" | "hybrid" | "ast";
  symbolKind?: "function" | "method" | "arrow" | "function-expr" | "class" | "interface" | "type" | "enum" | "namespace";
```
and forward `symbolKind` in the `engine.search` call:
```ts
      ...(input.symbolKind ? { symbolKind: input.symbolKind } : {}),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/mcp/src/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/src/tools.ts packages/mcp/src/__tests__/tools.test.ts
git commit -m "feat(mcp): accept mode 'ast' and symbolKind in sce_search"
```

---

## Task 13: Document AST symbol lookup in README and HANDOFF

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: the shipped behavior from Tasks 1–12.
- Produces: README documents `mode: "ast"` + `--symbol-kind`/MCP `symbolKind`; HANDOFF marks AST lookup shipped + follow-ups.

- [ ] **Step 1: Add an "AST symbol lookup" section to README**

Modify `README.md` — insert a new section after "## Hybrid search (opt-in)" (before "## Packages"):
````md
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
````

- [ ] **Step 2: Update README intro, MCP tools table, Packages table, Docs list, non-goals**

Modify `README.md`:
1. Intro paragraph — append "and AST symbol lookup" to the list of search types.
2. "not a vector database" line — move "AST symbol lookup" out of the behind-interfaces list (it's now shipped).
3. MCP tools table `sce_search` row — add "AST symbol lookup" to the mode list.
4. Packages table `@sce/retrieval` row — add "AST symbol lookup".
5. `## Docs` list — add two entries for the AST slice design + plan.
6. `## Explicit non-goals (v1)` — remove "AST search" (now shipped), keep "AST call hierarchy / references / inheritance" as a refined follow-up line.

- [ ] **Step 3: Mark AST shipped in HANDOFF.md**

Modify `HANDOFF.md`:
1. Current-state intro line — append "and AST symbol lookup".
2. Canonical docs — add two entries.
3. Known follow-ups — remove the generic "AST search strategies" line; replace with refined follow-ups: "AST call hierarchy, references, inheritance", "AST in hybrid (third RRF list)".
4. Append a new `### Shipped (AST symbol lookup slice, 2026-07-13)` subsection after the code-indexing shipped block, summarizing: `ISymbolIndex`/`SqliteSymbolIndex` + `symbols` table; `AstRetrievalStrategy` (tiered exact-then-prefix, direct scoring, `matchType`); `SearchQuery.symbolKind`/`SearchHit.symbolKind`; `symbolKind` rejected on keyword/semantic/hybrid; AST always wired (no gate); indexer writes/prunes symbols; CLI `--mode ast`/`--symbol-kind`; MCP `mode: "ast"`/`symbolKind`; shared `pathFilter` helper; follow-ups (call hierarchy, references, inheritance, AST-in-hybrid, `qualified_name`-as-query-input).

- [ ] **Step 4: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green (docs-only).

- [ ] **Step 5: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: document AST symbol lookup slice as shipped"
```

---

## Verification (final)

After Task 13, run the full verification suite:

- [ ] **Run:** `npm run typecheck && npm run build && npm test`
  Expected: typecheck clean, build clean, all tests green (code-indexing baseline `126` plus the new AST cases across core, storage, retrieval, indexing, runtime, cli, and mcp).
- [ ] **Confirm no `main` commits:** `git log --oneline origin/main..develop` lists the AST commits on `develop` only.
- [ ] **Confirm Pasttime untouched:** no new imports, links, or references to Pasttime in any package.
- [ ] **Confirm `symbolKind` rejection is consistent** across keyword/semantic/hybrid (same error wording pattern).
- [ ] **Confirm AST is always wired** (no `embedding` block needed for `mode: "ast"`).
- [ ] **Do not push** unless the user explicitly asks. **Do not open a PR** unless the user explicitly asks.
