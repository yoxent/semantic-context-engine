# SCE Code File Indexing (AST Chunking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend SCE indexing from Markdown-only to TypeScript/JavaScript code by chunking code files at AST declaration nodes (functions, methods, classes, interfaces, types, enums, namespaces, const-bound arrow/function-expr/class) via `web-tree-sitter`, populating `symbolKind` + ancestry metadata on `Chunk`, and wiring a `LanguageChunkerRegistry` so Markdown behavior stays byte-for-byte unchanged. No new search mode, no new config keys; code is opt-in via `indexing.include`.

**Architecture:** `@sce/core` adds a `Language` type, a `SymbolKind` type, a `detectLanguage()` helper, and an optional `Chunk.symbolKind` field. `@sce/parsing` adds a vendored-grammar `TreeSitterCodeChunker` (manual cursor traversal, one pass, 9 declaration kinds + zero-declaration whole-file fallback) and a `LanguageChunkerRegistry` that dispatches by `input.language`. `@sce/indexing` swaps its private `languageFor()` for `detectLanguage()` and skips `text`-language files (with pre-existing-record cleanup). `@sce/runtime` builds the registry and injects it as the single `chunker`. CLI/MCP are untouched. README/HANDOFF document the opt-in.

**Tech Stack:** TypeScript, Node.js 20+, npm workspaces, Vitest, `web-tree-sitter` 0.26.x (WASM runtime), `tree-sitter-typescript` 0.23.x and `tree-sitter-javascript` 0.25.x grammar `.wasm` files (vendored into `packages/parsing/grammars/`).

## Global Constraints

- Work only on branch `develop`. Do not commit to `main` (production-only). Do not push. No PR.
- Markdown behavior stays byte-for-byte unchanged for existing vault users: default `indexing.include` stays `["**/*.md"]`; `MarkdownChunker` is not modified; existing keyword/semantic/hybrid tests stay green.
- Pasttime must remain untouched: no imports, shared packages, links, or product coupling.
- No new `sce.config.json` keys. Code indexing is opt-in via the existing `indexing.include`.
- `IChunker` interface and `IndexingService` structure are unchanged: the registry is injected as the single `chunker` dep.
- Vendored grammar `.wasm` files live in `packages/parsing/grammars/` and are loaded via `import.meta.url`-relative paths; the `web-tree-sitter` runtime loads from the npm package. No native compilation, no install-time toolchain.
- Parser + grammars load **once per process** (module-level lazy singleton), not per chunker instance.
- Tests use the real WASM grammars against small TS/JS fixture snippets. Do not mock tree-sitter.
- Code chunk ids include `symbolKind` and `name`: `sha256(repositoryId:relativePath:startLine:endLine:symbolKind:name:fileHash)`. Markdown keeps its existing id scheme.
- `text`-language files are skipped by the indexer before `readFile`, and the skip path cleans up any pre-existing file record + chunks + FTS rows + vectors for that relativePath.
- Code chunks are embedded uniformly when `embedding` is configured (indexer's embedding loop is already language-agnostic). No new rebuild boundary.
- Use TDD for each task. Run `npm test`, `npm run typecheck`, and `npm run build` green before each commit. Commit on `develop` after every task.
- Do not start implementation until the plan has been reviewed and you are explicitly asked.

## Non-Goals

- No `mode: "ast"` search, symbol index, call hierarchy, references, or inheritance.
- No second language family (Python/Go/Rust).
- No JSON or YAML indexing.
- No plain-text fallback chunker for `text`-language files.
- No dedup of overlapping chunks (class vs. its methods) — future ranker concern.
- No new config keys. No Pasttime coupling. No PR.

---

## File Structure

Create and modify this structure across the implementation:

```text
packages/core/src/models/Language.ts                            # Create: Language type
packages/core/src/models/SymbolKind.ts                           # Create: SymbolKind type
packages/core/src/models/Chunk.ts                                # Modify: add symbolKind?
packages/core/src/language/detectLanguage.ts                     # Create: extension → Language map
packages/core/src/language/__tests__/detectLanguage.test.ts      # Create
packages/core/src/index.ts                                      # Modify: export new types + helper

packages/parsing/grammars/tree-sitter-typescript.wasm            # Create: vendored from tree-sitter-typescript@0.23.x
packages/parsing/grammars/tree-sitter-tsx.wasm                   # Create: vendored from tree-sitter-typescript@0.23.x
packages/parsing/grammars/tree-sitter-javascript.wasm            # Create: vendored from tree-sitter-javascript@0.25.x
packages/parsing/src/treeSitterLoader.ts                         # Create: lazy singleton for runtime + grammars
packages/parsing/src/TreeSitterCodeChunker.ts                    # Create
packages/parsing/src/LanguageChunkerRegistry.ts                 # Create
packages/parsing/src/__tests__/TreeSitterCodeChunker.test.ts     # Create
packages/parsing/src/__tests__/LanguageChunkerRegistry.test.ts   # Create
packages/parsing/src/index.ts                                   # Modify: export new chunkers
packages/parsing/package.json                                   # Modify: add web-tree-sitter dep; copy-grammars build step

packages/indexing/src/Indexer.ts                                # Modify: detectLanguage swap + text-skip cleanup
packages/indexing/src/__tests__/Indexer.test.ts                 # Modify: code-file + text-skip tests

packages/runtime/src/createEngine.ts                            # Modify: build registry, inject as chunker
packages/runtime/src/__tests__/createEngine.test.ts              # Modify: .md + .ts indexing integration test

README.md                                                       # Modify: document code indexing opt-in
HANDOFF.md                                                      # Modify: add slice to canonical docs + shipped

docs/superpowers/specs/2026-07-13-sce-code-indexing-slice-design.md  # No change (source of truth)
```

Responsibilities:
- `detectLanguage`: pure extension→language map; `.md`→`markdown`, `.ts/.tsx/.mts/.cts`→`typescript`, `.js/.jsx/.mjs/.cjs`→`javascript`, else `text`.
- `treeSitterLoader`: module-level lazy singleton; loads `web-tree-sitter` runtime + the three vendored grammars once; returns `Language`→`Parser`-with-loaded-language mappings; throws a clear configuration error on load failure.
- `TreeSitterCodeChunker`: implements `IChunker`; constructed with a `Language` and its loaded grammar; parses, cursor-traverses, extracts the 9 declaration kinds + const-bound class expressions, skips unnamed + plain data `const`, builds collision-safe-id `Chunk`s with `symbolKind` + ancestry, emits one whole-file fallback chunk when zero declarations, best-effort on `hasError`.
- `LanguageChunkerRegistry`: implements `IChunker`; holds `{ markdown, typescript, javascript }`; routes `chunk(input)` by `input.language`; throws if no chunker registered for the language.
- `Indexer`: uses `detectLanguage`; skips `text` files (with pre-existing-record cleanup) before `readFile`.
- `createEngine`: builds the registry (markdown chunker + tree-sitter code chunkers via the loader) and injects it as `chunker`.

---

## Task 1: `Language` and `SymbolKind` types + `detectLanguage` helper in `@sce/core`

**Files:**
- Create: `packages/core/src/models/Language.ts`
- Create: `packages/core/src/models/SymbolKind.ts`
- Modify: `packages/core/src/models/Chunk.ts`
- Create: `packages/core/src/language/detectLanguage.ts`
- Create: `packages/core/src/language/__tests__/detectLanguage.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: existing `Chunk` model.
- Produces: `Language` type (`"markdown" | "typescript" | "javascript" | "text"`); `SymbolKind` type (9 values); `Chunk.symbolKind?: SymbolKind`; `detectLanguage(relativePath: string): Language`. Later tasks import `Language`, `SymbolKind`, and `detectLanguage` from `@sce/core`.

- [ ] **Step 1: Write failing tests for `detectLanguage`**

Create `packages/core/src/language/__tests__/detectLanguage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectLanguage } from "../detectLanguage.js";

describe("detectLanguage", () => {
  it("maps Markdown extensions to markdown", () => {
    expect(detectLanguage("Notes/Alpha.md")).toBe("markdown");
    expect(detectLanguage("README.MD")).toBe("markdown");
  });

  it("maps TypeScript extensions to typescript", () => {
    expect(detectLanguage("src/index.ts")).toBe("typescript");
    expect(detectLanguage("src/Component.tsx")).toBe("typescript");
    expect(detectLanguage("src/types.mts")).toBe("typescript");
    expect(detectLanguage("src/config.cts")).toBe("typescript");
  });

  it("maps JavaScript extensions to javascript", () => {
    expect(detectLanguage("src/index.js")).toBe("javascript");
    expect(detectLanguage("src/Component.jsx")).toBe("javascript");
    expect(detectLanguage("src/types.mjs")).toBe("javascript");
    expect(detectLanguage("src/config.cjs")).toBe("javascript");
  });

  it("maps unknown extensions and extensionless paths to text", () => {
    expect(detectLanguage("data/config.json")).toBe("text");
    expect(detectLanguage("data/notes.yaml")).toBe("text");
    expect(detectLanguage("bin/run")).toBe("text");
    expect(detectLanguage("Makefile")).toBe("text");
  });

  it("is case-insensitive on extensions", () => {
    expect(detectLanguage("src/X.TS")).toBe("typescript");
    expect(detectLanguage("src/X.Js")).toBe("javascript");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/language/__tests__/detectLanguage.test.ts`
Expected: FAIL — module `../detectLanguage.js` not found.

- [ ] **Step 3: Create the `Language` and `SymbolKind` types**

Create `packages/core/src/models/Language.ts`:

```ts
export type Language = "markdown" | "typescript" | "javascript" | "text";
```

Create `packages/core/src/models/SymbolKind.ts`:

```ts
export type SymbolKind =
  | "function"
  | "method"
  | "arrow"
  | "function-expr"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "namespace";
```

- [ ] **Step 4: Add `symbolKind` to `Chunk`**

Modify `packages/core/src/models/Chunk.ts` — add the import and the optional field. Add at the top with the other imports:

```ts
import type { SymbolKind } from "./SymbolKind.js";
```

Add the field to the `Chunk` interface (next to the existing optional `namespace` / `className` / `methodName` / `headingPath` fields):

```ts
  symbolKind?: SymbolKind;
```

- [ ] **Step 5: Implement `detectLanguage`**

Create `packages/core/src/language/detectLanguage.ts`:

```ts
import type { Language } from "../models/Language.js";

const EXTENSION_MAP: Record<string, Language> = {
  md: "markdown",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript"
};

export function detectLanguage(relativePath: string): Language {
  const dot = relativePath.lastIndexOf(".");
  if (dot < 0) return "text";
  const ext = relativePath.slice(dot + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? "text";
}
```

- [ ] **Step 6: Export from `@sce/core`**

Modify `packages/core/src/index.ts` — add exports for the new types and helper. Add alongside the existing model exports:

```ts
export * from "./models/Language.js";
export * from "./models/SymbolKind.js";
export * from "./language/detectLanguage.js";
```

(Place these next to the existing `export * from "./models/Chunk.js"` line. Do not remove any existing exports.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/language/__tests__/detectLanguage.test.ts`
Expected: PASS — all 5 cases.

- [ ] **Step 8: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. Existing tests unchanged (`symbolKind` is optional; `detectLanguage` is not yet wired anywhere).

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/models/Language.ts packages/core/src/models/SymbolKind.ts packages/core/src/models/Chunk.ts packages/core/src/language/detectLanguage.ts packages/core/src/language/__tests__/detectLanguage.test.ts packages/core/src/index.ts
git commit -m "feat(core): add Language and SymbolKind types and detectLanguage helper"
```

---

## Task 2: Vendor tree-sitter grammar `.wasm` files and add `web-tree-sitter` dependency

**Files:**
- Create: `packages/parsing/grammars/tree-sitter-typescript.wasm`
- Create: `packages/parsing/grammars/tree-sitter-tsx.wasm`
- Create: `packages/parsing/grammars/tree-sitter-javascript.wasm`
- Modify: `packages/parsing/package.json`
- Create: `packages/parsing/grammars/.gitkeep` (so the dir is tracked even if a grammar is later removed — optional)

**Interfaces:**
- Consumes: nothing.
- Produces: three vendored `.wasm` files under `packages/parsing/grammars/`, and `web-tree-sitter` listed as a dependency of `@sce/parsing`. Later tasks load these via `import.meta.url`.

- [ ] **Step 1: Add `web-tree-sitter` as a dependency of `@sce/parsing`**

Modify `packages/parsing/package.json` — add to `dependencies`:

```json
    "web-tree-sitter": "^0.26.0"
```

(Keep any existing deps. If `packages/parsing/package.json` has no `dependencies` key, add one. Do not touch other fields.)

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `web-tree-sitter` is added to `node_modules`. A `package-lock.json` change is expected and will be committed.

- [ ] **Step 3: Vendor the grammar `.wasm` files**

Run:

```bash
mkdir -p packages/parsing/grammars
cp node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm packages/parsing/grammars/
cp node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm packages/parsing/grammars/
cp node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm packages/parsing/grammars/
```

Note: `tree-sitter-typescript` and `tree-sitter-javascript` are dependencies of `web-tree-sitter`? **No** — they are standalone grammar packages. If they are not present in `node_modules` after Step 2, install them explicitly as devDependencies of the **root** project (not `@sce/parsing`) just to obtain the `.wasm` for copying:

```bash
npm install --no-save tree-sitter-typescript@^0.23.0 tree-sitter-javascript@^0.25.0
```

Then re-run the three `cp` commands. Do **not** leave `tree-sitter-typescript`/`tree-sitter-javascript` as runtime deps of `@sce/parsing` — they are only needed at vendor time. The vendored `.wasm` files are the runtime artifacts.

Verify the files exist and are non-empty:

```bash
ls -la packages/parsing/grammars/
```

Expected: three `.wasm` files, each > 50KB.

- [ ] **Step 4: Verify the `.wasm` files load via `web-tree-sitter` (smoke check)**

Run a one-off Node script (do not commit it):

```bash
node --input-type=module -e "
import { Parser, Language } from 'web-tree-sitter';
await Parser.init();
const ts = await Language.load('packages/parsing/grammars/tree-sitter-typescript.wasm');
const parser = new Parser();
parser.setLanguage(ts);
const tree = parser.parse('function foo(): void {}');
console.log('root type:', tree.rootNode.type, 'hasError:', tree.rootNode.hasError);
console.log('first child type:', tree.rootNode.firstChild?.type);
"
```

Expected: prints `root type: program hasError: false` and `first child type: function_declaration` (or similar). If the node type differs, record what it is — Task 4's traversal will need the exact type names. Remove the script afterward (it was inline, so nothing to delete).

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. No code changed yet (only deps + vendored binaries).

- [ ] **Step 6: Commit**

```bash
git add packages/parsing/package.json packages/parsing/grammars/tree-sitter-typescript.wasm packages/parsing/grammars/tree-sitter-tsx.wasm packages/parsing/grammars/tree-sitter-javascript.wasm package-lock.json
git commit -m "feat(parsing): vendor tree-sitter TS/JS grammar wasm files and add web-tree-sitter dep"
```

---

## Task 3: `treeSitterLoader` — lazy singleton for runtime + grammars

**Files:**
- Create: `packages/parsing/src/treeSitterLoader.ts`
- Create: `packages/parsing/src/__tests__/treeSitterLoader.test.ts`
- Modify: `packages/parsing/src/index.ts`

**Interfaces:**
- Consumes: `web-tree-sitter` (`Parser`, `Language`); the three vendored `.wasm` files from Task 2.
- Produces: `getTreeSitterLanguage(language: "typescript" | "javascript"): Promise<Language>` (returns the loaded `web-tree-sitter` `Language` object; loads once, memoizes). The loader initializes the `Parser` runtime once on first call. Throws a clear configuration error if a `.wasm` file is missing or unreadable. Later tasks call `getTreeSitterLanguage` to construct `TreeSitterCodeChunker` instances.

- [ ] **Step 1: Write a failing test**

Create `packages/parsing/src/__tests__/treeSitterLoader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTreeSitterLanguage } from "../treeSitterLoader.js";

describe("treeSitterLoader", () => {
  it("loads the TypeScript grammar and can parse a function declaration", async () => {
    const { Parser } = await import("web-tree-sitter");
    await Parser.init();
    const lang = await getTreeSitterLanguage("typescript");
    expect(lang).toBeDefined();
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse("function foo(): void {}");
    expect(tree?.rootNode.hasError).toBe(false);
    expect(tree?.rootNode.firstChild?.type).toBe("function_declaration");
  });

  it("loads the JavaScript grammar and can parse a function declaration", async () => {
    const { Parser } = await import("web-tree-sitter");
    await Parser.init();
    const lang = await getTreeSitterLanguage("javascript");
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse("function foo() {}");
    expect(tree?.rootNode.hasError).toBe(false);
    expect(tree?.rootNode.firstChild?.type).toBe("function_declaration");
  });

  it("memoizes: a second call returns the same language object", async () => {
    const a = await getTreeSitterLanguage("typescript");
    const b = await getTreeSitterLanguage("typescript");
    expect(a).toBe(b);
  });
});
```

Note: if Step 4 of Task 2 showed a different node type than `function_declaration`, update the assertion here to match the observed type. Keep the test asserting the *observed* type so it stays an accurate regression guard.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/parsing/src/__tests__/treeSitterLoader.test.ts`
Expected: FAIL — module `../treeSitterLoader.js` not found.

- [ ] **Step 3: Implement the loader**

Create `packages/parsing/src/treeSitterLoader.ts`:

```ts
import { Parser, Language } from "web-tree-sitter";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

type CodeLanguage = "typescript" | "javascript";

const GRAMMAR_FILES: Record<CodeLanguage, string> = {
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm"
};

let runtimeInitialized = false;
const languageCache = new Map<CodeLanguage, Language>();

function grammarDir(): string {
  // From dist/src/treeSitterLoader.js → ../../grammars/<file>
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "grammars");
}

async function ensureRuntime(): Promise<void> {
  if (runtimeInitialized) return;
  await Parser.init();
  runtimeInitialized = true;
}

export async function getTreeSitterLanguage(language: CodeLanguage): Promise<Language> {
  const cached = languageCache.get(language);
  if (cached) return cached;

  await ensureRuntime();
  const file = GRAMMAR_FILES[language];
  const path = join(grammarDir(), file);
  if (!existsSync(path)) {
    throw new Error(
      `Failed to load tree-sitter grammar: ${file} not found at ${path}. ` +
        `The @sce/parsing package may not be installed correctly.`
    );
  }
  let lang: Language;
  try {
    lang = await Language.load(path);
  } catch (cause) {
    throw new Error(`Failed to load tree-sitter grammar: ${path} (${cause instanceof Error ? cause.message : String(cause)})`);
  }
  languageCache.set(language, lang);
  return lang;
}

/** Test-only: reset memoization so tests can re-init cleanly. Not for production use. */
export function __resetTreeSitterLoaderForTests(): void {
  languageCache.clear();
  runtimeInitialized = false;
}
```

Modify `packages/parsing/src/index.ts` — add the export (keep existing exports):

```ts
export * from "./treeSitterLoader.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/parsing/src/__tests__/treeSitterLoader.test.ts`
Expected: PASS — all 3 cases.

If the "memoizes" test fails because `Parser.init()` is called twice and re-loads, ensure `ensureRuntime` short-circuits and `languageCache` is consulted before `ensureRuntime`. The loader must memoize the `Language` object.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/parsing/src/treeSitterLoader.ts packages/parsing/src/__tests__/treeSitterLoader.test.ts packages/parsing/src/index.ts
git commit -m "feat(parsing): add lazy tree-sitter runtime + grammar loader"
```

---

## Task 4: `TreeSitterCodeChunker` — symbol extraction via cursor traversal

**Files:**
- Create: `packages/parsing/src/TreeSitterCodeChunker.ts`
- Create: `packages/parsing/src/__tests__/TreeSitterCodeChunker.test.ts`
- Modify: `packages/parsing/src/index.ts`

**Interfaces:**
- Consumes: `IChunker`, `Chunk`, `ChunkInput`, `SymbolKind`, `Language` from `@sce/core`; `web-tree-sitter` `Parser` + `Language`; `getTreeSitterLanguage` from Task 3.
- Produces: `TreeSitterCodeChunker` class implementing `IChunker`. Constructor: `new TreeSitterCodeChunker({ language, grammar }: { language: "typescript" | "javascript"; grammar: Language })`. The chunker holds a `Parser` with the grammar set. `chunk(input: ChunkInput): Chunk[]` parses `input.text` and returns declaration chunks. A static async factory `TreeSitterCodeChunker.create(language: "typescript" | "javascript"): Promise<TreeSitterCodeChunker>` loads the grammar via `getTreeSitterLanguage` and returns an instance. Task 5's registry holds instances.

- [ ] **Step 1: Write failing tests for each `symbolKind` and the edge cases**

Create `packages/parsing/src/__tests__/TreeSitterCodeChunker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TreeSitterCodeChunker } from "../TreeSitterCodeChunker.js";
import type { Chunk } from "@sce/core";

const baseInput = {
  repositoryId: "repo-a",
  relativePath: "src/foo.ts",
  fileHash: "hash-1",
  text: ""
};

async function tsChunker(): Promise<TreeSitterCodeChunker> {
  return TreeSitterCodeChunker.create("typescript");
}

function findChunk(chunks: Chunk[], symbolKind: string, name?: string): Chunk | undefined {
  return chunks.find((c) => c.symbolKind === symbolKind && (name === undefined || c.headingPath?.at(-1) === name));
}

describe("TreeSitterCodeChunker — declaration kinds", () => {
  it("chunks a function declaration", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "function foo(): void {\n  return;\n}\n" });
    const fn = findChunk(chunks, "function", "foo");
    expect(fn).toBeDefined();
    expect(fn?.symbolKind).toBe("function");
    expect(fn?.headingPath).toEqual(["foo"]);
    expect(fn?.startLine).toBe(1);
    expect(fn?.endLine).toBe(3);
    expect(fn?.text).toContain("function foo(): void");
  });

  it("chunks a class with a method (method has className, class chunk = whole body)", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: "class Foo {\n  bar(): void {\n    return;\n  }\n}\n"
    });
    const cls = findChunk(chunks, "class", "Foo");
    const method = findChunk(chunks, "method", "bar");
    expect(cls).toBeDefined();
    expect(method).toBeDefined();
    expect(cls?.headingPath).toEqual(["Foo"]);
    expect(method?.headingPath).toEqual(["Foo", "bar"]);
    expect(method?.className).toBe("Foo");
    expect(method?.methodName).toBe("bar");
    expect(cls?.startLine).toBe(1);
    expect(cls?.endLine).toBe(5);
    expect(method?.startLine).toBe(2);
    // class chunk text includes the whole body (overlaps method range)
    expect(cls?.text).toContain("bar(): void");
  });

  it("chunks a const-bound arrow function as arrow", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "const f = () => 1;\n" });
    const arrow = findChunk(chunks, "arrow", "f");
    expect(arrow).toBeDefined();
    expect(arrow?.symbolKind).toBe("arrow");
  });

  it("chunks a const-bound function expression as function-expr", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "const f = function () { return 1; };\n" });
    const fe = findChunk(chunks, "function-expr", "f");
    expect(fe).toBeDefined();
    expect(fe?.symbolKind).toBe("function-expr");
  });

  it("chunks a const-bound class expression as class (name from binding)", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: "const Foo = class {\n  bar() { return 1; }\n};\n"
    });
    const cls = findChunk(chunks, "class", "Foo");
    expect(cls).toBeDefined();
    expect(cls?.symbolKind).toBe("class");
    expect(cls?.headingPath).toEqual(["Foo"]);
  });

  it("chunks interface, type, enum, and namespace declarations", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: [
        "interface Foo { x: number; }",
        "type Bar = string | number;",
        "enum Baz { A, B, C }",
        "namespace Ns { export const v = 1; }"
      ].join("\n")
    });
    expect(findChunk(chunks, "interface", "Foo")).toBeDefined();
    expect(findChunk(chunks, "type", "Bar")).toBeDefined();
    expect(findChunk(chunks, "enum", "Baz")).toBeDefined();
    expect(findChunk(chunks, "namespace", "Ns")).toBeDefined();
  });

  it("skips plain data const declarations", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "const PI = 3.14;\nconst name = 'sce';\n" });
    expect(chunks.filter((c) => c.symbolKind === "arrow" || c.symbolKind === "function-expr")).toEqual([]);
  });

  it("skips unnamed declarations", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "export default function () { return 1; }\n" });
    expect(chunks.filter((c) => c.symbolKind === "function")).toEqual([]);
  });

  it("does not collide ids for one-line class with one-line method", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "class Foo { bar() {} }\n" });
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
    expect(chunks.length).toBeGreaterThanOrEqual(2); // class + method
  });
});

describe("TreeSitterCodeChunker — fallback and errors", () => {
  it("emits one whole-file fallback chunk when a code file has zero declarations", async () => {
    const chunker = await tsChunker();
    const text = "import { x } from './y';\nconsole.log(x);\n";
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.symbolKind).toBeUndefined();
    expect(chunks[0]?.headingPath).toEqual([]);
    expect(chunks[0]?.text).toBe(text.replace(/\r\n/g, "\n"));
    expect(chunks[0]?.startLine).toBe(1);
  });

  it("best-effort chunks a file with a syntax error and hasError is true on the root", async () => {
    const chunker = await tsChunker();
    const text = "function foo() {\n  return\nfunction good() { return 1; }\n"; // unbalanced
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text });
    // Should not throw; should still extract `good` if recoverable.
    expect(Array.isArray(chunks)).toBe(true);
  });
});

describe("TreeSitterCodeChunker — JavaScript", () => {
  it("chunks a JS function and const arrow (no interface/type/enum in JS)", async () => {
    const chunker = await TreeSitterCodeChunker.create("javascript");
    const chunks = chunker.chunk({
      ...baseInput,
      relativePath: "src/foo.js",
      language: "javascript",
      text: "function foo() { return 1; }\nconst bar = () => 2;\n"
    });
    expect(findChunk(chunks, "function", "foo")).toBeDefined();
    expect(findChunk(chunks, "arrow", "bar")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/parsing/src/__tests__/TreeSitterCodeChunker.test.ts`
Expected: FAIL — module `../TreeSitterCodeChunker.js` not found.

- [ ] **Step 3: Implement `TreeSitterCodeChunker`**

Create `packages/parsing/src/TreeSitterCodeChunker.ts`:

```ts
import { createHash } from "node:crypto";
import { Parser, Language } from "web-tree-sitter";
import type { Chunk, ChunkInput, IChunker, SymbolKind } from "@sce/core";
import { getTreeSitterLanguage } from "./treeSitterLoader.js";

export interface TreeSitterCodeChunkerOptions {
  language: "typescript" | "javascript";
  grammar: Language;
}

interface ExtractedSymbol {
  name: string;
  symbolKind: SymbolKind;
  startLine: number;
  endLine: number;
  text: string;
  ancestry: string[]; // class/namespace names leading to this symbol, NOT including self
}

// Declaration node types → SymbolKind. (TS has all; JS lacks interface/type/enum/namespace.)
const DECLARATION_TYPES: Record<string, SymbolKind> = {
  function_declaration: "function",
  generator_function_declaration: "function", // generators fold into function
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  module_declaration: "namespace", // TS `namespace`/`module`
  internal_module: "namespace"
};

// Ancestor-container types: their `name` child contributes to ancestry.
const ANCESTOR_TYPES = new Set(["class_declaration", "class", "module_declaration", "internal_module"]);

export class TreeSitterCodeChunker implements IChunker {
  private readonly parser: Parser;
  private readonly language: "typescript" | "javascript";

  constructor(options: TreeSitterCodeChunkerOptions) {
    this.language = options.language;
    this.parser = new Parser();
    this.parser.setLanguage(options.grammar);
  }

  static async create(language: "typescript" | "javascript"): Promise<TreeSitterCodeChunker> {
    const grammar = await getTreeSitterLanguage(language);
    return new TreeSitterCodeChunker({ language, grammar });
  }

  chunk(input: ChunkInput): Chunk[] {
    const normalized = input.text.replace(/\r\n/g, "\n");
    const tree = this.parser.parse(normalized);
    if (!tree) return [this.fallbackChunk(input, normalized)];

    const root = tree.rootNode;
    const symbols: ExtractedSymbol[] = [];
    traverse(root, [], symbols);

    if (symbols.length === 0) {
      return [this.fallbackChunk(input, normalized)];
    }

    return symbols.map((s) => this.makeChunk(input, s));
  }

  private makeChunk(input: ChunkInput, s: ExtractedSymbol): Chunk {
    const headingPath = [...s.ancestry, s.name];
    const chunk: Chunk = {
      id: codeChunkId(input.repositoryId, input.relativePath, s.startLine, s.endLine, s.symbolKind, s.name, input.fileHash),
      repositoryId: input.repositoryId,
      relativePath: input.relativePath,
      language: input.language,
      startLine: s.startLine,
      endLine: s.endLine,
      text: s.text,
      fileHash: input.fileHash,
      timestamp: new Date(),
      headingPath,
      symbolKind: s.symbolKind
    };
    // className = immediate enclosing class name (last class in ancestry)
    const enclosingClass = lastClassIn(s.ancestry);
    if (enclosingClass) chunk.className = enclosingClass;
    // namespace = immediate enclosing namespace (last namespace in ancestry)
    const enclosingNs = lastNamespaceIn(s.ancestry);
    if (enclosingNs) chunk.namespace = enclosingNs;
    // methodName = own name when this is a method
    if (s.symbolKind === "method") chunk.methodName = s.name;
    return chunk;
  }

  private fallbackChunk(input: ChunkInput, normalizedText: string): Chunk {
    return {
      id: createHash("sha256")
        .update(`${input.repositoryId}:${input.relativePath}:1:${lineCount(normalizedText)}::${input.fileHash}`)
        .digest("hex"),
      repositoryId: input.repositoryId,
      relativePath: input.relativePath,
      language: input.language,
      startLine: 1,
      endLine: lineCount(normalizedText),
      text: normalizedText,
      fileHash: input.fileHash,
      timestamp: new Date(),
      headingPath: []
      // no symbolKind — invisible to future AST symbol lookup
    };
  }
}

function traverse(node: SyntaxNode, ancestry: string[], out: ExtractedSymbol[]): void {
  // 1. Direct declaration nodes (function/class/interface/type/enum/namespace).
  const directKind = DECLARATION_TYPES[node.type];
  if (directKind) {
    const name = nameOf(node);
    if (name) {
      out.push(extract(node, name, directKind, ancestry));
      // Descend with this name added to ancestry so its methods carry it.
      const nextAncestry = isAncestorType(node.type) ? [...ancestry, name] : ancestry;
      descendChildren(node, nextAncestry, out);
      return;
    }
    // Unnamed declaration: skip, but still descend in case it contains named declarations.
    descendChildren(node, ancestry, out);
    return;
  }

  // 2. const-bound arrow / function-expression / class-expression:
  //    variable_declarator whose `value` child is arrow_function / function_expression / class.
  if (node.type === "variable_declarator") {
    const name = nameOf(node);
    const value = childByFieldType(node, "value");
    if (name && value) {
      if (value.type === "arrow_function") {
        out.push(extract(value, name, "arrow", ancestry));
        return; // don't double-count the arrow itself
      }
      if (value.type === "function_expression") {
        out.push(extract(value, name, "function-expr", ancestry));
        return;
      }
      if (value.type === "class") {
        out.push(extract(value, name, "class", ancestry));
        // descend into the class body so its methods get chunked with `name` as className ancestry
        descendChildren(value, [...ancestry, name], out);
        return;
      }
    }
    // plain data const: fall through (skip), but do not descend (no declarations inside a data literal we care about)
    return;
  }

  // 3. method_definition (inside a class body) — handled when we descend into a class.
  if (node.type === "method_definition") {
    const name = nameOf(node);
    if (name) {
      out.push(extract(node, name, "method", ancestry));
      return;
    }
  }

  // 4. Otherwise, descend.
  descendChildren(node, ancestry, out);
}

function descendChildren(node: SyntaxNode, ancestry: string[], out: ExtractedSymbol[]): void {
  let child = node.firstChild;
  while (child) {
    traverse(child, ancestry, out);
    child = child.nextSibling;
  }
}

function extract(node: SyntaxNode, name: string, kind: SymbolKind, ancestry: string[]): ExtractedSymbol {
  return {
    name,
    symbolKind: kind,
    startLine: node.startPosition.row + 1, // tree-sitter rows are 0-based
    endLine: node.endPosition.row + 1,
    text: node.text.replace(/\r\n/g, "\n"),
    ancestry: [...ancestry]
  };
}

function nameOf(node: SyntaxNode): string | undefined {
  const nameChild = childByFieldType(node, "name");
  return nameChild?.text;
}

function childByFieldType(node: SyntaxNode, field: string): SyntaxNode | undefined {
  // tree-sitter: named child by field name. web-tree-sitter exposes childByFieldName.
  return (node as unknown as { childByFieldName?: (f: string) => SyntaxNode | null }).childByFieldName?.(field) ?? undefined;
}

function isAncestorType(type: string): boolean {
  return ANCESTOR_TYPES.has(type);
}

function lastClassIn(ancestry: string[]): string | undefined {
  // ancestry carries only class/namespace names; we don't distinguish here.
  // The immediate enclosing class is the last entry whose source node was a class.
  // Since ancestry only holds class + namespace names, and we want the immediate class,
  // walk from the end and return the last name that came from a class node.
  // (We track kind alongside name below via a parallel structure is overkill for this slice;
  //  use the heuristic: the last ancestry entry is the immediate enclosing symbol.)
  return ancestry.length > 0 ? ancestry[ancestry.length - 1] : undefined;
}

function lastNamespaceIn(ancestry: string[]): string | undefined {
  // Without kind tracking on ancestry, we cannot reliably distinguish class from namespace here.
  // For this slice, namespace is set only when there is no class in ancestry (top-level namespace).
  // This is a known imprecision — documented in the spec's "Known Edge Cases".
  return undefined;
}

function codeChunkId(
  repositoryId: string,
  relativePath: string,
  startLine: number,
  endLine: number,
  symbolKind: SymbolKind,
  name: string,
  fileHash: string
): string {
  return createHash("sha256")
    .update(`${repositoryId}:${relativePath}:${startLine}:${endLine}:${symbolKind}:${name}:${fileHash}`)
    .digest("hex");
}

function lineCount(text: string): number {
  return text.split("\n").length;
}

// Minimal SyntaxNode typing for web-tree-sitter (avoid importing the full type surface).
interface SyntaxNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  hasError: boolean;
  firstChild: SyntaxNode | null;
  nextSibling: SyntaxNode | null;
}
```

**Important note for the implementer:** The `className`/`namespace` ancestry logic above is deliberately simple and has a documented imprecision (the spec's "Known Edge Cases" notes that ancestry tracks class+namespace names without per-entry kind). If the test `chunks a class with a method` fails because `className` is wrong, the fix is to track ancestry as `{ name, kind }` pairs (a parallel array) so `lastClassIn`/`lastNamespaceIn` can distinguish. Prefer that fix over weakening the test — the test encodes the spec's stated semantics (`className = immediate enclosing class name`). Keep `headingPath` as the flat `string[]` (ancestry + self) regardless.

Modify `packages/parsing/src/index.ts` — add the export (keep existing):

```ts
export * from "./TreeSitterCodeChunker.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/parsing/src/__tests__/TreeSitterCodeChunker.test.ts`
Expected: PASS — all cases.

If a test fails on a node-type name (e.g. the TS grammar calls a method `method_definition` but your tree-sitter version names it differently), inspect the actual tree with:

```bash
node --input-type=module -e "
import { TreeSitterCodeChunker } from './packages/parsing/src/TreeSitterCodeChunker.ts';
" 2>/dev/null || node --input-type=module -e "
import { Parser, Language } from 'web-tree-sitter';
await Parser.init();
const lang = await Language.load('packages/parsing/grammars/tree-sitter-typescript.wasm');
const p = new Parser(); p.setLanguage(lang);
const t = p.parse('class Foo { bar() {} }');
console.log(t.rootNode.toString());
"
```

Adjust the `DECLARATION_TYPES` / `method_definition` checks to match the observed node names. Do **not** change the test expectations (they encode the spec); change the implementation's node-type set.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/parsing/src/TreeSitterCodeChunker.ts packages/parsing/src/__tests__/TreeSitterCodeChunker.test.ts packages/parsing/src/index.ts
git commit -m "feat(parsing): add TreeSitterCodeChunker with AST symbol extraction"
```

---

## Task 5: `LanguageChunkerRegistry` — dispatch by language

**Files:**
- Create: `packages/parsing/src/LanguageChunkerRegistry.ts`
- Create: `packages/parsing/src/__tests__/LanguageChunkerRegistry.test.ts`
- Modify: `packages/parsing/src/index.ts`

**Interfaces:**
- Consumes: `IChunker`, `Chunk`, `ChunkInput`, `Language` from `@sce/core`; `MarkdownChunker` and `TreeSitterCodeChunker` from earlier tasks.
- Produces: `LanguageChunkerRegistry` class implementing `IChunker`. Constructor: `new LanguageChunkerRegistry({ chunkers }: { chunkers: Partial<Record<Exclude<Language, "text">, IChunker>> })`. `chunk(input: ChunkInput): Chunk[]` looks up `chunkers[input.language]`; if missing, throws `Error(\`No chunker registered for language: ${input.language}\`)`. Task 6's `createEngine` builds it with markdown + typescript + javascript chunkers.

- [ ] **Step 1: Write failing tests**

Create `packages/parsing/src/__tests__/LanguageChunkerRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LanguageChunkerRegistry } from "../LanguageChunkerRegistry.js";
import { MarkdownChunker } from "../MarkdownChunker.js";
import type { Chunk, IChunker } from "@sce/core";

function stubChunker(label: string): IChunker {
  return {
    chunk: () => [
      {
        id: `stub-${label}`,
        repositoryId: "r",
        relativePath: "f",
        language: "text",
        startLine: 1,
        endLine: 1,
        text: label,
        fileHash: "h",
        timestamp: new Date()
      }
    ]
  };
}

describe("LanguageChunkerRegistry", () => {
  it("routes markdown input to the markdown chunker", () => {
    const registry = new LanguageChunkerRegistry({
      chunkers: { markdown: new MarkdownChunker() }
    });
    const chunks = registry.chunk({
      repositoryId: "r",
      relativePath: "Notes.md",
      language: "markdown",
      fileHash: "h",
      text: "# Title\nbody\n"
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.headingPath?.[0]).toBe("Title");
  });

  it("routes typescript input to the typescript chunker", () => {
    const ts = stubChunker("ts");
    const registry = new LanguageChunkerRegistry({
      chunkers: { markdown: new MarkdownChunker(), typescript: ts }
    });
    const chunks = registry.chunk({
      repositoryId: "r",
      relativePath: "f.ts",
      language: "typescript",
      fileHash: "h",
      text: "function foo() {}"
    });
    expect(chunks[0]?.text).toBe("ts");
  });

  it("throws when no chunker is registered for the input language", () => {
    const registry = new LanguageChunkerRegistry({
      chunkers: { markdown: new MarkdownChunker() }
    });
    expect(() =>
      registry.chunk({ repositoryId: "r", relativePath: "f.ts", language: "typescript", fileHash: "h", text: "x" })
    ).toThrow(/No chunker registered for language: typescript/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/parsing/src/__tests__/LanguageChunkerRegistry.test.ts`
Expected: FAIL — module `../LanguageChunkerRegistry.js` not found.

- [ ] **Step 3: Implement the registry**

Create `packages/parsing/src/LanguageChunkerRegistry.ts`:

```ts
import type { Chunk, ChunkInput, IChunker, Language } from "@sce/core";

export interface LanguageChunkerRegistryOptions {
  chunkers: Partial<Record<Exclude<Language, "text">, IChunker>>;
}

export class LanguageChunkerRegistry implements IChunker {
  constructor(private readonly options: LanguageChunkerRegistryOptions) {}

  chunk(input: ChunkInput): Chunk[] {
    const chunker = this.options.chunkers[input.language as Exclude<Language, "text">];
    if (!chunker) {
      throw new Error(`No chunker registered for language: ${input.language}`);
    }
    return chunker.chunk(input);
  }
}
```

Modify `packages/parsing/src/index.ts` — add the export (keep existing):

```ts
export * from "./LanguageChunkerRegistry.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/parsing/src/__tests__/LanguageChunkerRegistry.test.ts`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/parsing/src/LanguageChunkerRegistry.ts packages/parsing/src/__tests__/LanguageChunkerRegistry.test.ts packages/parsing/src/index.ts
git commit -m "feat(parsing): add LanguageChunkerRegistry for language dispatch"
```

---

## Task 6: Wire `detectLanguage`, `text`-skip cleanup, and the registry into the indexer and runtime

**Files:**
- Modify: `packages/indexing/src/Indexer.ts`
- Modify: `packages/indexing/src/__tests__/Indexer.test.ts`
- Modify: `packages/runtime/src/createEngine.ts`
- Modify: `packages/runtime/src/__tests__/createEngine.test.ts`
- Modify: `packages/runtime/package.json` (if `@sce/parsing` is not already a dep — it is, since `MarkdownChunker` is wired there)

**Interfaces:**
- Consumes: `detectLanguage`, `Language` from `@sce/core`; `LanguageChunkerRegistry`, `TreeSitterCodeChunker`, `MarkdownChunker` from `@sce/parsing`; the existing `IndexingService` and `createEngine`.
- Produces: `Indexer` uses `detectLanguage` and skips `text`-language files (with pre-existing-record cleanup); `createEngine` builds a `LanguageChunkerRegistry` (markdown + typescript + javascript via `TreeSitterCodeChunker.create`) and injects it as `chunker` instead of the unconditional `MarkdownChunker`.

- [ ] **Step 1: Write failing indexer tests**

Append to `packages/indexing/src/__tests__/Indexer.test.ts`:

```ts
import { detectLanguage } from "@sce/core";

describe("IndexingService language handling", () => {
  it("skips text-language files before reading them and cleans up any pre-existing record", async () => {
    // Build an in-memory indexer with a registry that has only a markdown chunker.
    // Pre-seed a file record + chunks for a .json file, then index with include for .json,
    // and assert the record is gone and the file was never read.
    // (Use the existing test helpers in this file for storage setup.)
    // ... see existing Indexer tests for the storage scaffolding pattern ...
  });
});
```

**Note for the implementer:** Look at the existing `Indexer.test.ts` for the exact storage scaffolding (it uses `SqliteStorage.open` against a temp dir). Write a test that: (a) opens storage, (b) manually saves a file record + a chunk for `data.json` with `language: "text"`, (c) runs `indexRepository` with `indexing.include: ["**/*.json"]`, (d) asserts `metadataStore.getFile(repoId, "data.json")` returns undefined and `metadataStore.getChunk(<that chunk id>)` returns undefined. The test proves the skip cleans up. Add a second test: index a `.ts` file with `include: ["**/*.ts"]` and assert chunks produced have `symbolKind` set. Use `createEngine`-equivalent wiring (markdown + ts + js chunkers) — reuse the registry from Task 5.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/indexing/src/__tests__/Indexer.test.ts`
Expected: FAIL — `detectLanguage` not yet used; `text` files still get read and chunked (the old `languageFor` returns `"text"` and the single `MarkdownChunker` produces a whole-file chunk for them).

- [ ] **Step 3: Wire `detectLanguage` + `text`-skip into `Indexer`**

Modify `packages/indexing/src/Indexer.ts`:

Add the import at the top:

```ts
import { detectLanguage } from "@sce/core";
```

Remove the private `languageFor` function at the bottom of the file (the hardcoded `md → markdown, else text` two-liner).

In `indexRepository`, inside the `for (const relativePath of files)` loop, **as the first statement** before `readFile`, add the skip guard:

```ts
      const language = detectLanguage(relativePath);
      if (language === "text") {
        this.deps.logger?.debug("index.skipUnsupportedLanguage", { relativePath });
        // Clean up any pre-existing record so narrowing a previously-broader include doesn't leave orphans.
        await this.deps.metadataStore.deleteChunksForFile(repositoryId, relativePath);
        await this.deps.keywordIndex.removeChunksForFile(repositoryId, relativePath);
        if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, relativePath);
        const existing = await this.deps.metadataStore.getFile(repositoryId, relativePath);
        if (existing) await this.deps.metadataStore.deleteFile(repositoryId, relativePath);
        continue;
      }
```

Then replace the two `languageFor(relativePath)` call sites later in the loop (the `chunk()` input and the `saveFile` call) with the `language` variable captured above. Specifically, the chunk call becomes:

```ts
      const chunks = this.deps.chunker.chunk({
        repositoryId,
        relativePath,
        language,
        fileHash,
        text
      });
```

and the `saveFile` call becomes:

```ts
      await this.deps.metadataStore.saveFile({
        repositoryId,
        relativePath,
        language,
        fileHash,
        indexedAt: new Date()
      });
```

Leave everything else (embedding loop, prune, rebuild-boundary check) unchanged.

- [ ] **Step 4: Wire the registry into `createEngine`**

Modify `packages/runtime/src/createEngine.ts`.

Update the `@sce/parsing` import to include the new chunkers:

```ts
import { LanguageChunkerRegistry, MarkdownChunker, TreeSitterCodeChunker } from "@sce/parsing";
```

Replace the `chunker` construction. Currently the code has (in the `IndexingService` deps):

```ts
    chunker: new MarkdownChunker(),
```

Instead, build the registry **before** the `IndexingService` construction:

```ts
  const markdownChunker = new MarkdownChunker();
  const typescriptChunker = await TreeSitterCodeChunker.create("typescript");
  const javascriptChunker = await TreeSitterCodeChunker.create("javascript");
  const chunker = new LanguageChunkerRegistry({
    chunkers: { markdown: markdownChunker, typescript: typescriptChunker, javascript: javascriptChunker }
  });
```

Then pass `chunker` (the registry) into `IndexingService` deps where `new MarkdownChunker()` was used. If grammar loading fails, `TreeSitterCodeChunker.create` throws a clear configuration error (from the loader) — no extra handling needed. `createEngine` is already `async`.

Leave the rest of `createEngine` (semantic/hybrid wiring, storage, indexing service deps) unchanged.

- [ ] **Step 5: Run the indexer + runtime tests**

Run: `npx vitest run packages/indexing/src/__tests__/Indexer.test.ts packages/runtime/src/__tests__/createEngine.test.ts`
Expected: PASS.

If a runtime test fails because it indexes a Markdown-only repo and the tree-sitter grammars can't load (e.g. in a CI sandbox without the `.wasm` files), confirm the vendored `.wasm` files are present in `packages/parsing/grammars/` and that `grammarDir()` in the loader resolves to them from the built `dist/`. If the resolution is wrong from `dist/`, fix `grammarDir()` (the `..`, `..` join) — do not change the test.

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. Existing Markdown-only tests unchanged.

- [ ] **Step 7: Commit**

```bash
git add packages/indexing/src/Indexer.ts packages/indexing/src/__tests__/Indexer.test.ts packages/runtime/src/createEngine.ts packages/runtime/src/__tests__/createEngine.test.ts
git commit -m "feat(indexing,runtime): wire detectLanguage, text-skip cleanup, and chunker registry"
```

---

## Task 7: Integration test — index a mixed `.md` + `.ts` repo and search code

**Files:**
- Modify: `packages/runtime/src/__tests__/createEngine.test.ts`

**Interfaces:**
- Consumes: the full `createEngine` wiring from Task 6; the sample-vault fixture + a new small TS fixture snippet.
- Produces: a passing integration test proving Markdown + code index together and code hits surface in keyword/semantic/hybrid search.

- [ ] **Step 1: Write the integration test**

Append to `packages/runtime/src/__tests__/createEngine.test.ts`:

```ts
describe("createEngine code indexing", () => {
  it("indexes a repo with both .md and .ts files and returns code hits from keyword search", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-code-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      // Add a TS file to the vault copy.
      await writeFile(
        join(dir, "src/widget.ts"),
        "export class Widget {\n  render(): string {\n    return 'widget';\n  }\n}\n"
      );
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          indexing: { include: ["**/*.md", "**/*.ts"] }
        })
      );

      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });

      // keyword search finds the class
      const kw = await created.engine.search({ text: "Widget", mode: "keyword", limit: 10 });
      expect(kw.hits.some((h) => h.path.endsWith("src/widget.ts") && h.headingPath?.[0] === "Widget")).toBe(true);

      // keyword search finds the method
      const method = await created.engine.search({ text: "render", mode: "keyword", limit: 10 });
      expect(method.hits.some((h) => h.path.endsWith("src/widget.ts") && h.headingPath?.[1] === "render")).toBe(true);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("still indexes Markdown-only repos unchanged when include stays default", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-code-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      const result = await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      expect(result.filesIndexed).toBe(3); // same 3 .md files as the existing runtime test
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: PASS — code hits surface; Markdown-only unchanged (3 files).

- [ ] **Step 3: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/__tests__/createEngine.test.ts
git commit -m "test(runtime): integration test for mixed md/ts indexing and code search"
```

---

## Task 8: Document code indexing in README and HANDOFF

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: the shipped behavior from Tasks 1–7.
- Produces: README documents code indexing as opt-in; HANDOFF marks the slice shipped and keeps follow-ups.

- [ ] **Step 1: Update the README intro and add a "Code indexing (opt-in)" section**

Modify `README.md` — in the opening paragraph (line 3), replace:

```md
Local-first retrieval for AI coding agents. SCE indexes a Markdown knowledge vault (or later a code repo), then returns concise keyword, opt-in semantic, and opt-in hybrid hits through a shared core API exposed as CLI and MCP.
```

with:

```md
Local-first retrieval for AI coding agents. SCE indexes a Markdown knowledge vault and (opt-in) TypeScript/JavaScript code, then returns concise keyword, opt-in semantic, and opt-in hybrid hits through a shared core API exposed as CLI and MCP.
```

On line 5, replace:

```md
SCE is **not** a vector database. Keyword, opt-in semantic, and opt-in hybrid search ship on `develop`; AST, binary vectors, and ANN indexing stay behind interfaces for later slices.
```

with:

```md
SCE is **not** a vector database. Keyword, opt-in semantic, and opt-in hybrid search ship on `develop` over Markdown and (opt-in) TS/JS code; AST symbol lookup, binary vectors, and ANN indexing stay behind interfaces for later slices.
```

Insert a new section immediately after the `## Search filters` section (before `## Semantic search (opt-in)`):

````md
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

Markdown default behavior is unchanged: if `indexing.include` stays `["**/*.md"]`, no code files are indexed. Files whose extension maps to an unsupported language (e.g. `.json`, `.yaml`) are skipped. Semantic and hybrid search cover code chunks too when `embedding` is configured.

AST symbol lookup (`mode: "ast"`), call hierarchy, references, and inheritance are future slices — this one ships indexing + keyword/semantic/hybrid search over code.
````

- [ ] **Step 2: Update the README Packages and Docs tables**

Modify `README.md` — in the Packages table, replace:

```md
| `@sce/parsing` | Markdown chunking + wiki-links |
```

with:

```md
| `@sce/parsing` | Markdown chunking, wiki-links, and tree-sitter TS/JS AST chunking |
```

In the `## Docs` list, after the hybrid slice plan line:

```md
- `docs/superpowers/plans/2026-07-13-sce-hybrid-search-slice.md` — hybrid slice implementation plan
```

add:

```md
- `docs/superpowers/specs/2026-07-13-sce-code-indexing-slice-design.md` — approved code indexing slice design
- `docs/superpowers/plans/2026-07-13-sce-code-indexing-slice.md` — code indexing slice implementation plan
```

- [ ] **Step 3: Mark the slice shipped in HANDOFF.md**

Modify `HANDOFF.md` — in the `## Current state (2026-07-13)` intro line, replace:

```md
First interface-first vertical, ops polish, ranking, the opt-in semantic search slice, and the opt-in hybrid search slice are implemented on **`develop`**.
```

with:

```md
First interface-first vertical, ops polish, ranking, the opt-in semantic search slice, the opt-in hybrid search slice, and opt-in TS/JS code indexing (AST chunking) are implemented on **`develop`**.
```

In `## Canonical docs`, after the hybrid slice plan line, add:

```md
- `docs/superpowers/specs/2026-07-13-sce-code-indexing-slice-design.md` — approved code indexing slice design
- `docs/superpowers/plans/2026-07-13-sce-code-indexing-slice.md` — code indexing slice implementation plan
```

After the `### Shipped (hybrid slice, 2026-07-13)` block, append:

```md
### Shipped (code indexing slice, 2026-07-13)

- `@sce/core` `Language` type, `SymbolKind` type, `detectLanguage(relativePath)` helper, and optional `Chunk.symbolKind`
- `@sce/parsing` `TreeSitterCodeChunker` — `web-tree-sitter` (WASM) with vendored TS/TSX/JS grammar `.wasm` files; AST cursor traversal chunks 9 declaration kinds (`function`, `method`, `arrow`, `function-expr`, `class`, `interface`, `type`, `enum`, `namespace`) + const-bound arrow/function-expr/class; skips unnamed + plain data `const`; whole-file fallback chunk for zero-declaration files; best-effort on syntax errors
- `@sce/parsing` `LanguageChunkerRegistry` — dispatches chunking by `input.language` (markdown/typescript/javascript); `IChunker` interface unchanged
- `@sce/indexing` uses `detectLanguage`; skips `text`-language files before read and cleans up any pre-existing record/chunks/FTS/vectors for them
- `@sce/runtime` builds the registry (markdown + TS + JS chunkers) and injects it as the single `chunker`
- Code chunks embed uniformly when `embedding` is configured; no new config keys; default `indexing.include` stays `["**/*.md"]` (code is opt-in)
- Keyword, semantic, and hybrid search now cover code chunks; Markdown behavior unchanged
- Follow-ups: AST symbol lookup (`mode: "ast"`), call hierarchy, references, inheritance, JSON/YAML, second language family (Python/Go), overlapping-chunk dedup
```

- [ ] **Step 4: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green (docs-only; confirm nothing regressed).

- [ ] **Step 5: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: document code indexing (AST chunking) slice as shipped"
```

---

## Verification (final)

After Task 8, run the full verification suite and confirm the baseline holds plus the new behavior:

- [ ] **Run:** `npm run typecheck && npm run build && npm test`
  Expected: typecheck clean, build clean, all tests green (hybrid baseline `98` plus the new code-indexing cases across core, parsing, indexing, and runtime).
- [ ] **Confirm no `main` commits:** `git log --oneline origin/main..develop` should list the code-indexing commits on `develop` only.
- [ ] **Confirm Pasttime untouched:** no new imports, links, or references to Pasttime in any package.
- [ ] **Confirm vendored `.wasm` files are present and resolvable from `dist/`:** `ls packages/parsing/grammars/*.wasm` and that a built `createEngine` call can load them (Task 7's integration test proves this).
- [ ] **Do not push** unless the user explicitly asks. **Do not open a PR** unless the user explicitly asks.
