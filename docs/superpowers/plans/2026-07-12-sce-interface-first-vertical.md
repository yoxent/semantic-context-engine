# SCE Interface-First Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first useful SCE vertical: index a local Markdown vault, search it with keyword retrieval, and expose the same core API through CLI and MCP.

**Architecture:** Use a TypeScript npm-workspaces monorepo. `packages/core` owns public models, interfaces, config, logging, and the orchestration service. Domain packages implement those interfaces, while `packages/cli` and `packages/mcp` stay thin adapters over `core`.

**Tech Stack:** TypeScript, Node.js 20+, npm workspaces, Vitest, SQLite FTS5 through `better-sqlite3`, `fast-glob`, `ignore`, `zod`, `commander`, and `@modelcontextprotocol/sdk`.

## Global Constraints

- Do not couple SCE to Pasttime.
- Do not add Cloudflare deployment or web UI in this implementation slice.
- Do not implement embeddings, vector storage, AST search, hybrid retrieval, graph traversal, or full code parsers.
- Store the local index in per-root `.sce/metadata.sqlite`.
- Keep CLI and MCP as adapters over `packages/core`; they must not own indexing, parsing, ranking, or storage logic.
- Walk only explicit user-provided paths.
- Keep CLI quiet by default; expose diagnostics through `--verbose` or explicit response fields.
- Do not log full chunk text by default.
- Use TDD for each task.
- Commit after each task when executing this plan.

---

## File Structure

Create this structure across the implementation:

```text
package.json
tsconfig.base.json
vitest.config.ts
packages/core/package.json
packages/core/src/api/SemanticContextEngine.ts
packages/core/src/api/index.ts
packages/core/src/config/defaults.ts
packages/core/src/config/schema.ts
packages/core/src/interfaces/*.ts
packages/core/src/logging/Logger.ts
packages/core/src/models/*.ts
packages/core/src/index.ts
packages/indexing/package.json
packages/indexing/src/FileDiscovery.ts
packages/indexing/src/Indexer.ts
packages/indexing/src/IgnoreRules.ts
packages/indexing/src/__tests__/*.test.ts
packages/parsing/package.json
packages/parsing/src/MarkdownChunker.ts
packages/parsing/src/WikiLinks.ts
packages/parsing/src/__tests__/*.test.ts
packages/storage/package.json
packages/storage/src/SqliteStorage.ts
packages/storage/src/schema.ts
packages/storage/src/__tests__/*.test.ts
packages/ranking/package.json
packages/ranking/src/SimpleRanker.ts
packages/ranking/src/__tests__/*.test.ts
packages/retrieval/package.json
packages/retrieval/src/KeywordRetrievalStrategy.ts
packages/retrieval/src/__tests__/*.test.ts
packages/cli/package.json
packages/cli/src/main.ts
packages/cli/src/__tests__/*.test.ts
packages/mcp/package.json
packages/mcp/src/server.ts
packages/mcp/src/tools.ts
packages/mcp/src/__tests__/*.test.ts
fixtures/sample-vault/README.md
fixtures/sample-vault/Architecture.md
fixtures/sample-vault/Agent-Context.md
```

---

### Task 1: Workspace Tooling And Package Shells

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/*/package.json`
- Create: `packages/*/src/index.ts`

**Interfaces:**
- Produces: workspace layout, test/build scripts, package names.
- Consumes: no application code.

- [ ] **Step 1: Create workspace manifest**

Create `package.json`:

```json
{
  "name": "semantic-context-engine",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "tsc -b packages/*",
    "test": "vitest run",
    "typecheck": "tsc -b packages/* --pretty false"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install -D typescript vitest tsx @types/node
npm install better-sqlite3 fast-glob ignore zod commander @modelcontextprotocol/sdk
npm install -D @types/better-sqlite3
```

Expected: dependencies are added to `package.json` and `package-lock.json` is created.

- [ ] **Step 3: Create base TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "rootDir": ".",
    "outDir": "dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts"],
    environment: "node"
  }
});
```

- [ ] **Step 5: Create package manifests**

For each package, create a manifest with the same pattern. Example for `packages/core/package.json`:

```json
{
  "name": "@sce/core",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

Create matching manifests for:

```text
@sce/indexing
@sce/parsing
@sce/storage
@sce/ranking
@sce/retrieval
@sce/cli
@sce/mcp
@sce/embedding
```

For package dependencies, add only the local or external packages used by that package:

```json
{
  "dependencies": {
    "@sce/core": "0.0.0"
  }
}
```

- [ ] **Step 6: Create package TypeScript configs**

Create `packages/core/tsconfig.json` and copy it to every package, adjusting only package references when a package depends on another local package:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 7: Create empty exports**

Create `packages/core/src/index.ts`:

```ts
export {};
```

Create the same `export {};` file in each package `src/index.ts`.

- [ ] **Step 8: Verify workspace compiles and tests**

Run:

```bash
npm run typecheck
npm test
```

Expected: both commands pass. Vitest may report no tests yet; if current Vitest exits nonzero with no tests, add `packages/core/src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("workspace", () => {
  it("runs tests", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts packages
git commit -m "chore: set up TypeScript workspace"
```

---

### Task 2: Core Models, Interfaces, And Search Orchestrator

**Files:**
- Create: `packages/core/src/models/Repository.ts`
- Create: `packages/core/src/models/Chunk.ts`
- Create: `packages/core/src/models/Search.ts`
- Create: `packages/core/src/interfaces/RetrievalStrategy.ts`
- Create: `packages/core/src/interfaces/Chunker.ts`
- Create: `packages/core/src/interfaces/Storage.ts`
- Create: `packages/core/src/interfaces/Ranker.ts`
- Create: `packages/core/src/interfaces/Embedding.ts`
- Create: `packages/core/src/interfaces/VectorStore.ts`
- Create: `packages/core/src/api/SemanticContextEngine.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/api/SemanticContextEngine.test.ts`

**Interfaces:**
- Produces: `SemanticContextEngine`, `SearchQuery`, `SearchResult`, `Chunk`, repository and plugin interfaces.
- Consumes: no domain implementations.

- [ ] **Step 1: Write failing search orchestration test**

Create `packages/core/src/api/SemanticContextEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SemanticContextEngine } from "./SemanticContextEngine.js";
import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { SearchHit, SearchQuery } from "../models/Search.js";

describe("SemanticContextEngine", () => {
  it("routes generic search to keyword strategy in v1", async () => {
    const calls: SearchQuery[] = [];
    const keyword: IRetrievalStrategy = {
      name: "keyword",
      search: async (query) => {
        calls.push(query);
        const hit: SearchHit = {
          chunkId: "chunk-1",
          score: 1,
          strategy: "keyword",
          snippet: "retrieval framework",
          path: "README.md",
          startLine: 1,
          endLine: 3
        };
        return { hits: [hit], diagnostics: { strategy: "keyword" } };
      }
    };

    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    const result = await engine.search({ text: "retrieval", limit: 5 });

    expect(calls).toEqual([{ text: "retrieval", limit: 5 }]);
    expect(result.hits[0]?.chunkId).toBe("chunk-1");
    expect(result.diagnostics?.strategy).toBe("keyword");
  });

  it("rejects unsupported explicit modes until implemented", async () => {
    const keyword: IRetrievalStrategy = {
      name: "keyword",
      search: async () => ({ hits: [] })
    };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });

    await expect(engine.search({ text: "architecture", mode: "semantic" })).rejects.toThrow(
      "Search mode semantic is not implemented in v1"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- packages/core/src/api/SemanticContextEngine.test.ts
```

Expected: FAIL because model and API files do not exist.

- [ ] **Step 3: Add core models**

Create `packages/core/src/models/Repository.ts`:

```ts
export type RepositoryType = "code" | "vault";

export interface Repository {
  id: string;
  rootPath: string;
  type: RepositoryType;
  indexedAt: Date;
  displayName?: string;
}
```

Create `packages/core/src/models/Chunk.ts`:

```ts
export interface Chunk {
  id: string;
  repositoryId: string;
  relativePath: string;
  language: string;
  startLine: number;
  endLine: number;
  text: string;
  fileHash: string;
  timestamp: Date;
  namespace?: string;
  className?: string;
  methodName?: string;
  headingPath?: string[];
  gitCommitHash?: string;
  wikiLinks?: string[];
}
```

Create `packages/core/src/models/Search.ts`:

```ts
export type SearchMode = "keyword" | "semantic" | "ast" | "hybrid";

export interface SearchQuery {
  text: string;
  repositoryIds?: string[];
  mode?: SearchMode;
  limit?: number;
  pathFilter?: string;
  language?: string;
}

export interface SearchHit {
  chunkId: string;
  score: number;
  strategy: SearchMode;
  snippet: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface SearchDiagnostics {
  strategy: SearchMode;
  elapsedMs?: number;
  scannedChunks?: number;
}

export interface SearchResult {
  hits: SearchHit[];
  diagnostics?: SearchDiagnostics;
}
```

- [ ] **Step 4: Add plugin interfaces**

Create `packages/core/src/interfaces/RetrievalStrategy.ts`:

```ts
import type { SearchQuery, SearchResult, SearchMode } from "../models/Search.js";

export interface IRetrievalStrategy {
  name: SearchMode;
  search(query: SearchQuery): Promise<SearchResult>;
}
```

Create `packages/core/src/interfaces/Chunker.ts`:

```ts
import type { Chunk } from "../models/Chunk.js";

export interface ChunkInput {
  repositoryId: string;
  relativePath: string;
  language: string;
  fileHash: string;
  text: string;
}

export interface IChunker {
  chunk(input: ChunkInput): Chunk[];
}
```

Create `packages/core/src/interfaces/Storage.ts`:

```ts
import type { Chunk } from "../models/Chunk.js";
import type { Repository } from "../models/Repository.js";
import type { SearchHit, SearchQuery } from "../models/Search.js";

export interface FileRecord {
  repositoryId: string;
  relativePath: string;
  language: string;
  fileHash: string;
  indexedAt: Date;
}

export interface IMetadataStore {
  saveRepository(repository: Repository): Promise<void>;
  getRepository(id: string): Promise<Repository | undefined>;
  deleteRepository(id: string): Promise<void>;
  saveFile(record: FileRecord): Promise<void>;
  getFile(repositoryId: string, relativePath: string): Promise<FileRecord | undefined>;
  deleteFile(repositoryId: string, relativePath: string): Promise<void>;
  saveChunks(chunks: Chunk[]): Promise<void>;
  getChunk(id: string): Promise<Chunk | undefined>;
  deleteChunksForFile(repositoryId: string, relativePath: string): Promise<void>;
}

export interface IKeywordIndex {
  indexChunks(chunks: Chunk[]): Promise<void>;
  removeChunksForFile(repositoryId: string, relativePath: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchHit[]>;
}
```

Create `packages/core/src/interfaces/Ranker.ts`:

```ts
import type { SearchHit, SearchQuery } from "../models/Search.js";

export interface IRanker {
  rank(hits: SearchHit[], query: SearchQuery): SearchHit[];
}
```

Create `packages/core/src/interfaces/Embedding.ts`:

```ts
export interface IEmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}
```

Create `packages/core/src/interfaces/VectorStore.ts`:

```ts
export interface VectorSearchQuery {
  repositoryIds?: string[];
  vector: number[];
  limit: number;
}

export interface VectorSearchHit {
  chunkId: string;
  score: number;
}

export interface IVectorStore {
  upsert(chunkId: string, vector: number[]): Promise<void>;
  search(query: VectorSearchQuery): Promise<VectorSearchHit[]>;
  delete(chunkId: string): Promise<void>;
}
```

- [ ] **Step 5: Implement core API shell**

Create `packages/core/src/api/SemanticContextEngine.ts`:

```ts
import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { SearchMode, SearchQuery, SearchResult } from "../models/Search.js";

export interface SemanticContextEngineDeps {
  keywordStrategy: IRetrievalStrategy;
}

export class SemanticContextEngine {
  constructor(private readonly deps: SemanticContextEngineDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    const mode = query.mode ?? "keyword";
    if (mode !== "keyword") {
      throw new Error(`Search mode ${mode} is not implemented in v1`);
    }
    return this.keywordSearch(query);
  }

  async keywordSearch(query: SearchQuery): Promise<SearchResult> {
    return this.deps.keywordStrategy.search({ ...query, mode: "keyword" });
  }

  async semanticSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("semantic", query);
  }

  async astSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("ast", query);
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("hybrid", query);
  }

  private unsupported(mode: SearchMode, _query: SearchQuery): never {
    throw new Error(`Search mode ${mode} is not implemented in v1`);
  }
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./api/SemanticContextEngine.js";
export * from "./interfaces/Chunker.js";
export * from "./interfaces/Embedding.js";
export * from "./interfaces/Ranker.js";
export * from "./interfaces/RetrievalStrategy.js";
export * from "./interfaces/Storage.js";
export * from "./interfaces/VectorStore.js";
export * from "./models/Chunk.js";
export * from "./models/Repository.js";
export * from "./models/Search.js";
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- packages/core/src/api/SemanticContextEngine.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat: define core SCE contracts"
```

---

### Task 3: Config Loading And Ignore Rules

**Files:**
- Create: `packages/core/src/config/schema.ts`
- Create: `packages/core/src/config/defaults.ts`
- Create: `packages/core/src/config/loadConfig.ts`
- Create: `packages/indexing/src/IgnoreRules.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/indexing/src/index.ts`
- Test: `packages/core/src/config/loadConfig.test.ts`
- Test: `packages/indexing/src/__tests__/IgnoreRules.test.ts`

**Interfaces:**
- Produces: `SceConfig`, `loadConfig`, `createIgnoreMatcher`.
- Consumes: `zod`, `ignore`.

- [ ] **Step 1: Write failing config tests**

Create `packages/core/src/config/loadConfig.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./loadConfig.js";

describe("loadConfig", () => {
  it("uses defaults when sce.config.json is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-config-"));
    try {
      const config = await loadConfig(dir);
      expect(config.indexing.include).toEqual(["**/*.md"]);
      expect(config.search.defaultLimit).toBe(10);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("merges user config with defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-config-"));
    try {
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({ search: { defaultLimit: 3 }, logging: { level: "debug" } })
      );
      const config = await loadConfig(dir);
      expect(config.indexing.ignore).toContain(".git/**");
      expect(config.search.defaultLimit).toBe(3);
      expect(config.logging.level).toBe("debug");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Write failing ignore tests**

Create `packages/indexing/src/__tests__/IgnoreRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createIgnoreMatcher } from "../IgnoreRules.js";

describe("createIgnoreMatcher", () => {
  it("excludes default ignored paths", () => {
    const matcher = createIgnoreMatcher({ include: ["**/*.md"], ignore: [] });
    expect(matcher("README.md")).toBe(true);
    expect(matcher(".git/config")).toBe(false);
    expect(matcher(".sce/metadata.sqlite")).toBe(false);
    expect(matcher("node_modules/pkg/index.js")).toBe(false);
    expect(matcher("dist/app.js")).toBe(false);
  });

  it("lets includes narrow indexed files", () => {
    const matcher = createIgnoreMatcher({ include: ["notes/**/*.md"], ignore: ["notes/private/**"] });
    expect(matcher("notes/public/idea.md")).toBe(true);
    expect(matcher("notes/private/secret.md")).toBe(false);
    expect(matcher("src/index.ts")).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- packages/core/src/config/loadConfig.test.ts packages/indexing/src/__tests__/IgnoreRules.test.ts
```

Expected: FAIL because config and ignore modules do not exist.

- [ ] **Step 4: Implement config schema and defaults**

Create `packages/core/src/config/schema.ts`:

```ts
import { z } from "zod";

export const repositoryConfigSchema = z.object({
  path: z.string(),
  type: z.enum(["code", "vault"]),
  name: z.string().optional()
});

export const sceConfigSchema = z.object({
  repositories: z.array(repositoryConfigSchema).default([]),
  indexing: z
    .object({
      include: z.array(z.string()).default(["**/*.md"]),
      ignore: z.array(z.string()).default([])
    })
    .default({}),
  search: z
    .object({
      defaultLimit: z.number().int().positive().default(10),
      maxSnippetChars: z.number().int().positive().default(500)
    })
    .default({}),
  logging: z
    .object({
      level: z.enum(["silent", "error", "warn", "info", "debug"]).default("info")
    })
    .default({})
});

export type SceConfig = z.infer<typeof sceConfigSchema>;
```

Create `packages/core/src/config/defaults.ts`:

```ts
import type { SceConfig } from "./schema.js";

export const defaultIgnorePatterns = [
  ".git/**",
  ".sce/**",
  "node_modules/**",
  "dist/**",
  "build/**",
  "coverage/**",
  "Library/**",
  "Temp/**",
  "obj/**",
  "bin/**",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.webp",
  "**/*.pdf",
  "**/*.zip"
];

export const defaultConfig: SceConfig = {
  repositories: [],
  indexing: {
    include: ["**/*.md"],
    ignore: defaultIgnorePatterns
  },
  search: {
    defaultLimit: 10,
    maxSnippetChars: 500
  },
  logging: {
    level: "info"
  }
};
```

Create `packages/core/src/config/loadConfig.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, defaultIgnorePatterns } from "./defaults.js";
import { sceConfigSchema, type SceConfig } from "./schema.js";

export async function loadConfig(rootPath: string): Promise<SceConfig> {
  const configPath = join(rootPath, "sce.config.json");
  let raw: unknown = {};

  try {
    raw = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Failed to read ${configPath}: ${(error as Error).message}`);
    }
  }

  const parsed = sceConfigSchema.parse(raw);
  return {
    repositories: parsed.repositories,
    indexing: {
      include: parsed.indexing.include,
      ignore: [...new Set([...defaultIgnorePatterns, ...parsed.indexing.ignore])]
    },
    search: {
      defaultLimit: parsed.search.defaultLimit ?? defaultConfig.search.defaultLimit,
      maxSnippetChars: parsed.search.maxSnippetChars ?? defaultConfig.search.maxSnippetChars
    },
    logging: {
      level: parsed.logging.level ?? defaultConfig.logging.level
    }
  };
}
```

- [ ] **Step 5: Implement ignore matcher**

Create `packages/indexing/src/IgnoreRules.ts`:

```ts
import ignore from "ignore";
import { defaultIgnorePatterns } from "@sce/core";

export interface IgnoreRuleInput {
  include: string[];
  ignore: string[];
}

export function createIgnoreMatcher(input: IgnoreRuleInput): (relativePath: string) => boolean {
  const ignored = ignore().add([...defaultIgnorePatterns, ...input.ignore]);
  const included = ignore().add(input.include.length > 0 ? input.include : ["**/*"]);

  return (relativePath: string): boolean => {
    const normalized = relativePath.replace(/\\/g, "/");
    if (ignored.ignores(normalized)) {
      return false;
    }
    return included.ignores(normalized);
  };
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./api/SemanticContextEngine.js";
export * from "./config/defaults.js";
export * from "./config/loadConfig.js";
export * from "./config/schema.js";
export * from "./interfaces/Chunker.js";
export * from "./interfaces/Embedding.js";
export * from "./interfaces/Ranker.js";
export * from "./interfaces/RetrievalStrategy.js";
export * from "./interfaces/Storage.js";
export * from "./interfaces/VectorStore.js";
export * from "./models/Chunk.js";
export * from "./models/Repository.js";
export * from "./models/Search.js";
```

Modify `packages/indexing/src/index.ts`:

```ts
export * from "./IgnoreRules.js";
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- packages/core/src/config/loadConfig.test.ts packages/indexing/src/__tests__/IgnoreRules.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core packages/indexing
git commit -m "feat: add config and ignore rules"
```

---

### Task 4: Markdown Chunking And Wiki-Link Extraction

**Files:**
- Create: `packages/parsing/src/WikiLinks.ts`
- Create: `packages/parsing/src/MarkdownChunker.ts`
- Modify: `packages/parsing/src/index.ts`
- Test: `packages/parsing/src/__tests__/WikiLinks.test.ts`
- Test: `packages/parsing/src/__tests__/MarkdownChunker.test.ts`

**Interfaces:**
- Consumes: `IChunker`, `ChunkInput`, `Chunk`.
- Produces: `extractWikiLinks`, `MarkdownChunker`.

- [ ] **Step 1: Write failing wiki-link tests**

Create `packages/parsing/src/__tests__/WikiLinks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractWikiLinks } from "../WikiLinks.js";

describe("extractWikiLinks", () => {
  it("extracts plain and aliased links", () => {
    expect(extractWikiLinks("See [[Agent Context]] and [[Architecture|system design]].")).toEqual([
      "Agent Context",
      "Architecture"
    ]);
  });

  it("deduplicates links in encounter order", () => {
    expect(extractWikiLinks("[[A]] [[B]] [[A]]")).toEqual(["A", "B"]);
  });
});
```

- [ ] **Step 2: Write failing chunker tests**

Create `packages/parsing/src/__tests__/MarkdownChunker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MarkdownChunker } from "../MarkdownChunker.js";

const chunker = new MarkdownChunker();

describe("MarkdownChunker", () => {
  it("creates one file-level chunk when no headings exist", () => {
    const chunks = chunker.chunk({
      repositoryId: "repo",
      relativePath: "note.md",
      language: "markdown",
      fileHash: "hash",
      text: "One\nTwo\n[[Agent Context]]\n"
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[0]?.endLine).toBe(3);
    expect(chunks[0]?.headingPath).toEqual([]);
    expect(chunks[0]?.wikiLinks).toEqual(["Agent Context"]);
  });

  it("chunks heading sections with nested heading paths", () => {
    const chunks = chunker.chunk({
      repositoryId: "repo",
      relativePath: "Architecture.md",
      language: "markdown",
      fileHash: "hash",
      text: "# Architecture\nIntro\n## Storage\nSQLite\n## Retrieval\nKeyword\n"
    });

    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([
      ["Architecture"],
      ["Architecture", "Storage"],
      ["Architecture", "Retrieval"]
    ]);
    expect(chunks.map((chunk) => [chunk.startLine, chunk.endLine])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6]
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- packages/parsing/src/__tests__/WikiLinks.test.ts packages/parsing/src/__tests__/MarkdownChunker.test.ts
```

Expected: FAIL because parser files do not exist.

- [ ] **Step 4: Implement wiki-link extraction**

Create `packages/parsing/src/WikiLinks.ts`:

```ts
export function extractWikiLinks(text: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const target = match[1]?.trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }

  return links;
}
```

- [ ] **Step 5: Implement Markdown chunker**

Create `packages/parsing/src/MarkdownChunker.ts`:

```ts
import type { Chunk, ChunkInput, IChunker } from "@sce/core";
import { createHash } from "node:crypto";
import { extractWikiLinks } from "./WikiLinks.js";

interface Heading {
  level: number;
  title: string;
  line: number;
}

export class MarkdownChunker implements IChunker {
  chunk(input: ChunkInput): Chunk[] {
    const lines = input.text.replace(/\r\n/g, "\n").split("\n");
    const headings = findHeadings(lines);

    if (headings.length === 0) {
      return [this.createChunk(input, [], 1, trimTrailingEmptyLine(lines.length, lines), input.text)];
    }

    return headings.map((heading, index) => {
      const next = headings[index + 1];
      const startLine = heading.line;
      const endLine = next ? next.line - 1 : trimTrailingEmptyLine(lines.length, lines);
      const sectionText = lines.slice(startLine - 1, endLine).join("\n");
      return this.createChunk(input, headingPathFor(headings, index), startLine, endLine, sectionText);
    });
  }

  private createChunk(
    input: ChunkInput,
    headingPath: string[],
    startLine: number,
    endLine: number,
    text: string
  ): Chunk {
    return {
      id: createChunkId(input.repositoryId, input.relativePath, startLine, endLine, input.fileHash),
      repositoryId: input.repositoryId,
      relativePath: input.relativePath,
      language: input.language,
      startLine,
      endLine,
      text,
      fileHash: input.fileHash,
      timestamp: new Date(),
      headingPath,
      wikiLinks: extractWikiLinks(text)
    };
  }
}

function findHeadings(lines: string[]): Heading[] {
  return lines.flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) return [];
    return [{ level: match[1].length, title: match[2], line: index + 1 }];
  });
}

function headingPathFor(headings: Heading[], index: number): string[] {
  const current = headings[index];
  const path: Heading[] = [current];

  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = headings[i];
    if (candidate.level < path[0].level) {
      path.unshift(candidate);
    }
  }

  return path.map((heading) => heading.title);
}

function trimTrailingEmptyLine(lineCount: number, lines: string[]): number {
  return lines.at(-1) === "" ? Math.max(1, lineCount - 1) : lineCount;
}

function createChunkId(repositoryId: string, relativePath: string, startLine: number, endLine: number, fileHash: string): string {
  return createHash("sha256")
    .update(`${repositoryId}:${relativePath}:${startLine}:${endLine}:${fileHash}`)
    .digest("hex");
}
```

Modify `packages/parsing/src/index.ts`:

```ts
export * from "./MarkdownChunker.js";
export * from "./WikiLinks.js";
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- packages/parsing/src/__tests__/WikiLinks.test.ts packages/parsing/src/__tests__/MarkdownChunker.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/parsing
git commit -m "feat: chunk markdown vault files"
```

---

### Task 5: SQLite Metadata Store And FTS Keyword Index

**Files:**
- Create: `packages/storage/src/schema.ts`
- Create: `packages/storage/src/SqliteStorage.ts`
- Modify: `packages/storage/src/index.ts`
- Test: `packages/storage/src/__tests__/SqliteStorage.test.ts`

**Interfaces:**
- Consumes: `IMetadataStore`, `IKeywordIndex`, `Chunk`, `SearchQuery`.
- Produces: `SqliteStorage`.

- [ ] **Step 1: Write failing storage tests**

Create `packages/storage/src/__tests__/SqliteStorage.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { SqliteStorage } from "../SqliteStorage.js";
import type { Chunk } from "@sce/core";

describe("SqliteStorage", () => {
  it("persists chunks and searches through FTS", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    try {
      const storage = await SqliteStorage.open(dir);
      const chunk: Chunk = {
        id: "chunk-1",
        repositoryId: "repo",
        relativePath: "Architecture.md",
        language: "markdown",
        startLine: 1,
        endLine: 2,
        text: "# Architecture\nSQLite stores metadata.",
        fileHash: "hash",
        timestamp: new Date("2026-07-12T00:00:00.000Z"),
        headingPath: ["Architecture"],
        wikiLinks: ["Storage"]
      };

      await storage.saveChunks([chunk]);
      await storage.indexChunks([chunk]);

      const hits = await storage.search({ text: "SQLite metadata", limit: 5 });

      expect(hits).toHaveLength(1);
      expect(hits[0]?.chunkId).toBe("chunk-1");
      expect(hits[0]?.path).toBe("Architecture.md");
      expect(hits[0]?.snippet).toContain("SQLite");
      storage.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- packages/storage/src/__tests__/SqliteStorage.test.ts
```

Expected: FAIL because storage implementation does not exist.

- [ ] **Step 3: Add SQLite schema**

Create `packages/storage/src/schema.ts`:

```ts
export const createSchemaSql = `
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  type TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  display_name TEXT
);

CREATE TABLE IF NOT EXISTS files (
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  PRIMARY KEY (repository_id, relative_path)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  text TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  heading_path_json TEXT NOT NULL,
  wiki_links_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunk_links (
  source_chunk_id TEXT NOT NULL,
  target TEXT NOT NULL,
  PRIMARY KEY (source_chunk_id, target)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED,
  repository_id UNINDEXED,
  relative_path,
  heading_path,
  text
);
`;
```

- [ ] **Step 4: Implement SQLite storage**

Create `packages/storage/src/SqliteStorage.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { Chunk, FileRecord, IKeywordIndex, IMetadataStore, Repository, SearchHit, SearchQuery } from "@sce/core";
import { createSchemaSql } from "./schema.js";

export class SqliteStorage implements IMetadataStore, IKeywordIndex {
  private constructor(private readonly db: Database.Database) {}

  static async open(rootPath: string): Promise<SqliteStorage> {
    const sceDir = join(rootPath, ".sce");
    await mkdir(sceDir, { recursive: true });
    const db = new Database(join(sceDir, "metadata.sqlite"));
    db.exec(createSchemaSql);
    return new SqliteStorage(db);
  }

  close(): void {
    this.db.close();
  }

  async saveRepository(repository: Repository): Promise<void> {
    this.db.prepare(
      `INSERT OR REPLACE INTO repositories (id, root_path, type, indexed_at, display_name)
       VALUES (@id, @rootPath, @type, @indexedAt, @displayName)`
    ).run({ ...repository, indexedAt: repository.indexedAt.toISOString(), displayName: repository.displayName ?? null });
  }

  async getRepository(id: string): Promise<Repository | undefined> {
    const row = this.db.prepare("SELECT * FROM repositories WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      rootPath: row.root_path,
      type: row.type,
      indexedAt: new Date(row.indexed_at),
      displayName: row.display_name ?? undefined
    };
  }

  async deleteRepository(id: string): Promise<void> {
    this.db.prepare("DELETE FROM repositories WHERE id = ?").run(id);
    this.db.prepare("DELETE FROM files WHERE repository_id = ?").run(id);
    this.db.prepare("DELETE FROM chunks WHERE repository_id = ?").run(id);
    this.db.prepare("DELETE FROM chunks_fts WHERE repository_id = ?").run(id);
  }

  async saveFile(record: FileRecord): Promise<void> {
    this.db.prepare(
      `INSERT OR REPLACE INTO files (repository_id, relative_path, language, file_hash, indexed_at)
       VALUES (@repositoryId, @relativePath, @language, @fileHash, @indexedAt)`
    ).run({ ...record, indexedAt: record.indexedAt.toISOString() });
  }

  async getFile(repositoryId: string, relativePath: string): Promise<FileRecord | undefined> {
    const row = this.db.prepare("SELECT * FROM files WHERE repository_id = ? AND relative_path = ?").get(repositoryId, relativePath) as any;
    if (!row) return undefined;
    return {
      repositoryId: row.repository_id,
      relativePath: row.relative_path,
      language: row.language,
      fileHash: row.file_hash,
      indexedAt: new Date(row.indexed_at)
    };
  }

  async deleteFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db.prepare("DELETE FROM files WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
  }

  async saveChunks(chunks: Chunk[]): Promise<void> {
    const insertChunk = this.db.prepare(
      `INSERT OR REPLACE INTO chunks
       (id, repository_id, relative_path, language, start_line, end_line, text, file_hash, timestamp, heading_path_json, wiki_links_json)
       VALUES (@id, @repositoryId, @relativePath, @language, @startLine, @endLine, @text, @fileHash, @timestamp, @headingPathJson, @wikiLinksJson)`
    );
    const insertLink = this.db.prepare("INSERT OR IGNORE INTO chunk_links (source_chunk_id, target) VALUES (?, ?)");
    const tx = this.db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        insertChunk.run(toChunkRow(chunk));
        for (const link of chunk.wikiLinks ?? []) insertLink.run(chunk.id, link);
      }
    });
    tx(chunks);
  }

  async getChunk(id: string): Promise<Chunk | undefined> {
    const row = this.db.prepare("SELECT * FROM chunks WHERE id = ?").get(id) as any;
    return row ? fromChunkRow(row) : undefined;
  }

  async deleteChunksForFile(repositoryId: string, relativePath: string): Promise<void> {
    const rows = this.db.prepare("SELECT id FROM chunks WHERE repository_id = ? AND relative_path = ?").all(repositoryId, relativePath) as { id: string }[];
    const tx = this.db.transaction(() => {
      for (const row of rows) this.db.prepare("DELETE FROM chunk_links WHERE source_chunk_id = ?").run(row.id);
      this.db.prepare("DELETE FROM chunks WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
    });
    tx();
  }

  async indexChunks(chunks: Chunk[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO chunks_fts (chunk_id, repository_id, relative_path, heading_path, text)
       VALUES (@id, @repositoryId, @relativePath, @headingPath, @text)`
    );
    const tx = this.db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        insert.run({ ...chunk, headingPath: (chunk.headingPath ?? []).join(" / ") });
      }
    });
    tx(chunks);
  }

  async removeChunksForFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db.prepare("DELETE FROM chunks_fts WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const limit = query.limit ?? 10;
    const rows = this.db.prepare(
      `SELECT chunk_id, relative_path, snippet(chunks_fts, 4, '', '', ' ... ', 16) AS snippet, bm25(chunks_fts) AS rank
       FROM chunks_fts
       WHERE chunks_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    ).all(query.text, limit) as any[];

    return rows.map((row) => {
      const chunk = this.db.prepare("SELECT start_line, end_line FROM chunks WHERE id = ?").get(row.chunk_id) as any;
      return {
        chunkId: row.chunk_id,
        score: Math.abs(Number(row.rank)),
        strategy: "keyword",
        snippet: row.snippet,
        path: row.relative_path,
        startLine: chunk?.start_line ?? 1,
        endLine: chunk?.end_line ?? 1
      };
    });
  }
}

function toChunkRow(chunk: Chunk): Record<string, unknown> {
  return {
    id: chunk.id,
    repositoryId: chunk.repositoryId,
    relativePath: chunk.relativePath,
    language: chunk.language,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    text: chunk.text,
    fileHash: chunk.fileHash,
    timestamp: chunk.timestamp.toISOString(),
    headingPathJson: JSON.stringify(chunk.headingPath ?? []),
    wikiLinksJson: JSON.stringify(chunk.wikiLinks ?? [])
  };
}

function fromChunkRow(row: any): Chunk {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    relativePath: row.relative_path,
    language: row.language,
    startLine: row.start_line,
    endLine: row.end_line,
    text: row.text,
    fileHash: row.file_hash,
    timestamp: new Date(row.timestamp),
    headingPath: JSON.parse(row.heading_path_json),
    wikiLinks: JSON.parse(row.wiki_links_json)
  };
}
```

Modify `packages/storage/src/index.ts`:

```ts
export * from "./SqliteStorage.js";
export * from "./schema.js";
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- packages/storage/src/__tests__/SqliteStorage.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/storage
git commit -m "feat: add sqlite metadata and keyword index"
```

---

### Task 6: File Discovery And Index Update Pipeline

**Files:**
- Create: `packages/indexing/src/FileDiscovery.ts`
- Create: `packages/indexing/src/Indexer.ts`
- Modify: `packages/indexing/src/index.ts`
- Create: `fixtures/sample-vault/README.md`
- Create: `fixtures/sample-vault/Architecture.md`
- Create: `fixtures/sample-vault/Agent-Context.md`
- Test: `packages/indexing/src/__tests__/Indexer.test.ts`

**Interfaces:**
- Consumes: `IChunker`, `IMetadataStore`, `IKeywordIndex`, `RepositoryType`.
- Produces: `IndexRepositoryOptions`, `IndexingService`.

- [ ] **Step 1: Add fixture vault**

Create `fixtures/sample-vault/README.md`:

```md
# Sample Vault

Semantic Context Engine helps agents retrieve relevant local context.

See [[Architecture]] and [[Agent-Context]].
```

Create `fixtures/sample-vault/Architecture.md`:

```md
# Architecture

SCE uses a public API with replaceable retrieval strategies.

## Storage

SQLite FTS5 stores keyword-searchable chunks.
```

Create `fixtures/sample-vault/Agent-Context.md`:

```md
# Agent Context

Agents should receive concise snippets before requesting full chunks.
```

- [ ] **Step 2: Write failing indexing test**

Create `packages/indexing/src/__tests__/Indexer.test.ts`:

```ts
import { mkdtemp, rm, cp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { MarkdownChunker } from "@sce/parsing";
import { SqliteStorage } from "@sce/storage";
import { IndexingService } from "../Indexer.js";

describe("IndexingService", () => {
  it("indexes markdown vault chunks and refreshes changed files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-"));
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      const storage = await SqliteStorage.open(dir);
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage
      });

      const result = await service.indexRepository({ rootPath: dir, type: "vault" });
      expect(result.filesIndexed).toBe(3);
      expect(result.chunksIndexed).toBeGreaterThanOrEqual(3);

      const hits = await storage.search({ text: "SQLite FTS5", limit: 5 });
      expect(hits[0]?.path).toBe("Architecture.md");
      storage.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run:

```bash
npm test -- packages/indexing/src/__tests__/Indexer.test.ts
```

Expected: FAIL because discovery and indexing services do not exist.

- [ ] **Step 4: Implement file discovery**

Create `packages/indexing/src/FileDiscovery.ts`:

```ts
import fg from "fast-glob";
import { relative } from "node:path";
import { createIgnoreMatcher } from "./IgnoreRules.js";

export interface DiscoverFilesOptions {
  rootPath: string;
  include: string[];
  ignore: string[];
}

export async function discoverFiles(options: DiscoverFilesOptions): Promise<string[]> {
  const matcher = createIgnoreMatcher({ include: options.include, ignore: options.ignore });
  const files = await fg(options.include, {
    cwd: options.rootPath,
    onlyFiles: true,
    dot: true,
    unique: true
  });

  return files
    .map((file) => relative(options.rootPath, `${options.rootPath}/${file}`).replace(/\\/g, "/"))
    .filter((file) => matcher(file))
    .sort();
}
```

- [ ] **Step 5: Implement indexing service**

Create `packages/indexing/src/Indexer.ts`:

```ts
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IChunker, IKeywordIndex, IMetadataStore, RepositoryType } from "@sce/core";
import { defaultConfig } from "@sce/core";
import { discoverFiles } from "./FileDiscovery.js";

export interface IndexRepositoryOptions {
  rootPath: string;
  type: RepositoryType;
  repositoryId?: string;
}

export interface IndexRepositoryResult {
  repositoryId: string;
  filesIndexed: number;
  chunksIndexed: number;
}

export interface IndexingServiceDeps {
  chunker: IChunker;
  metadataStore: IMetadataStore;
  keywordIndex: IKeywordIndex;
}

export class IndexingService {
  constructor(private readonly deps: IndexingServiceDeps) {}

  async indexRepository(options: IndexRepositoryOptions): Promise<IndexRepositoryResult> {
    const repositoryId = options.repositoryId ?? createRepositoryId(options.rootPath);
    await this.deps.metadataStore.saveRepository({
      id: repositoryId,
      rootPath: options.rootPath,
      type: options.type,
      indexedAt: new Date()
    });

    const files = await discoverFiles({
      rootPath: options.rootPath,
      include: defaultConfig.indexing.include,
      ignore: defaultConfig.indexing.ignore
    });

    let chunksIndexed = 0;
    for (const relativePath of files) {
      const absolutePath = join(options.rootPath, relativePath);
      const text = await readFile(absolutePath, "utf8");
      const fileHash = sha256(text);
      const existing = await this.deps.metadataStore.getFile(repositoryId, relativePath);
      if (existing?.fileHash === fileHash) continue;

      await this.deps.metadataStore.deleteChunksForFile(repositoryId, relativePath);
      await this.deps.keywordIndex.removeChunksForFile(repositoryId, relativePath);

      const chunks = this.deps.chunker.chunk({
        repositoryId,
        relativePath,
        language: languageFor(relativePath),
        fileHash,
        text
      });

      await this.deps.metadataStore.saveFile({
        repositoryId,
        relativePath,
        language: languageFor(relativePath),
        fileHash,
        indexedAt: new Date()
      });
      await this.deps.metadataStore.saveChunks(chunks);
      await this.deps.keywordIndex.indexChunks(chunks);
      chunksIndexed += chunks.length;
    }

    return { repositoryId, filesIndexed: files.length, chunksIndexed };
  }
}

function createRepositoryId(rootPath: string): string {
  return sha256(rootPath).slice(0, 16);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function languageFor(relativePath: string): string {
  return relativePath.endsWith(".md") ? "markdown" : "text";
}
```

Modify `packages/indexing/src/index.ts`:

```ts
export * from "./FileDiscovery.js";
export * from "./IgnoreRules.js";
export * from "./Indexer.js";
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- packages/indexing/src/__tests__/Indexer.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add fixtures packages/indexing
git commit -m "feat: index markdown vault files"
```

---

### Task 7: Ranking And Keyword Retrieval Strategy

**Files:**
- Create: `packages/ranking/src/SimpleRanker.ts`
- Create: `packages/retrieval/src/KeywordRetrievalStrategy.ts`
- Modify: `packages/ranking/src/index.ts`
- Modify: `packages/retrieval/src/index.ts`
- Test: `packages/ranking/src/__tests__/SimpleRanker.test.ts`
- Test: `packages/retrieval/src/__tests__/KeywordRetrievalStrategy.test.ts`

**Interfaces:**
- Consumes: `IRanker`, `IKeywordIndex`, `IRetrievalStrategy`.
- Produces: `SimpleRanker`, `KeywordRetrievalStrategy`.

- [ ] **Step 1: Write failing ranking test**

Create `packages/ranking/src/__tests__/SimpleRanker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SimpleRanker } from "../SimpleRanker.js";

describe("SimpleRanker", () => {
  it("boosts file and heading matches and applies limit", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        { chunkId: "a", score: 1, strategy: "keyword", snippet: "body", path: "Notes.md", startLine: 1, endLine: 1 },
        { chunkId: "b", score: 1, strategy: "keyword", snippet: "# Architecture", path: "Architecture.md", startLine: 1, endLine: 2 }
      ],
      { text: "Architecture", limit: 1 }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.chunkId).toBe("b");
  });
});
```

- [ ] **Step 2: Write failing retrieval strategy test**

Create `packages/retrieval/src/__tests__/KeywordRetrievalStrategy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { KeywordRetrievalStrategy } from "../KeywordRetrievalStrategy.js";

describe("KeywordRetrievalStrategy", () => {
  it("searches keyword index and ranks hits", async () => {
    const strategy = new KeywordRetrievalStrategy({
      keywordIndex: {
        search: async () => [
          { chunkId: "chunk-1", score: 1, strategy: "keyword", snippet: "SQLite metadata", path: "Architecture.md", startLine: 1, endLine: 2 }
        ],
        indexChunks: async () => undefined,
        removeChunksForFile: async () => undefined
      },
      ranker: {
        rank: (hits) => hits.map((hit) => ({ ...hit, score: hit.score + 10 }))
      }
    });

    const result = await strategy.search({ text: "SQLite", limit: 5 });

    expect(result.hits[0]?.score).toBe(11);
    expect(result.diagnostics?.strategy).toBe("keyword");
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- packages/ranking/src/__tests__/SimpleRanker.test.ts packages/retrieval/src/__tests__/KeywordRetrievalStrategy.test.ts
```

Expected: FAIL because ranking and retrieval files do not exist.

- [ ] **Step 4: Implement simple ranker**

Create `packages/ranking/src/SimpleRanker.ts`:

```ts
import type { IRanker, SearchHit, SearchQuery } from "@sce/core";

export class SimpleRanker implements IRanker {
  rank(hits: SearchHit[], query: SearchQuery): SearchHit[] {
    const needle = query.text.toLowerCase();
    const ranked = hits.map((hit) => {
      let score = hit.score;
      if (hit.path.toLowerCase().includes(needle)) score += 5;
      if (hit.snippet.toLowerCase().includes(needle)) score += 2;
      if (hit.snippet.toLowerCase().includes(` ${needle} `)) score += 1;
      return { ...hit, score };
    });

    return ranked.sort((a, b) => b.score - a.score).slice(0, query.limit ?? ranked.length);
  }
}
```

Modify `packages/ranking/src/index.ts`:

```ts
export * from "./SimpleRanker.js";
```

- [ ] **Step 5: Implement keyword retrieval strategy**

Create `packages/retrieval/src/KeywordRetrievalStrategy.ts`:

```ts
import type { IKeywordIndex, IRanker, IRetrievalStrategy, SearchQuery, SearchResult } from "@sce/core";

export interface KeywordRetrievalStrategyDeps {
  keywordIndex: IKeywordIndex;
  ranker: IRanker;
}

export class KeywordRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "keyword" as const;

  constructor(private readonly deps: KeywordRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    const start = performance.now();
    const hits = await this.deps.keywordIndex.search({ ...query, mode: "keyword" });
    const ranked = this.deps.ranker.rank(hits, query);
    return {
      hits: ranked,
      diagnostics: {
        strategy: "keyword",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: hits.length
      }
    };
  }
}
```

Modify `packages/retrieval/src/index.ts`:

```ts
export * from "./KeywordRetrievalStrategy.js";
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- packages/ranking/src/__tests__/SimpleRanker.test.ts packages/retrieval/src/__tests__/KeywordRetrievalStrategy.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ranking packages/retrieval
git commit -m "feat: add keyword retrieval strategy"
```

---

### Task 8: CLI And MCP Adapters

**Files:**
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/createEngine.ts`
- Create: `packages/mcp/src/createEngine.ts`
- Create: `packages/mcp/src/tools.ts`
- Create: `packages/mcp/src/server.ts`
- Modify: `packages/cli/package.json`
- Modify: `packages/mcp/package.json`
- Modify: `packages/core/src/api/SemanticContextEngine.ts`
- Test: `packages/cli/src/__tests__/main.test.ts`
- Test: `packages/mcp/src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `SemanticContextEngine`, `IndexingService`, `SqliteStorage`, `MarkdownChunker`, `SimpleRanker`, `KeywordRetrievalStrategy`.
- Produces: `sce` CLI commands and MCP tool handlers.

- [ ] **Step 1: Extend core engine with indexing and chunk fetching**

Modify `packages/core/src/api/SemanticContextEngine.ts` so the constructor accepts optional `indexingService` and `metadataStore`:

```ts
import type { IMetadataStore } from "../interfaces/Storage.js";
import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { RepositoryType } from "../models/Repository.js";
import type { SearchMode, SearchQuery, SearchResult } from "../models/Search.js";
import type { Chunk } from "../models/Chunk.js";

export interface IndexRepositoryInput {
  rootPath: string;
  type: RepositoryType;
}

export interface IndexRepositoryOutput {
  repositoryId: string;
  filesIndexed: number;
  chunksIndexed: number;
}

export interface IIndexingService {
  indexRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput>;
}

export interface SemanticContextEngineDeps {
  keywordStrategy: IRetrievalStrategy;
  indexingService?: IIndexingService;
  metadataStore?: IMetadataStore;
}

export class SemanticContextEngine {
  constructor(private readonly deps: SemanticContextEngineDeps) {}

  async indexRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput> {
    if (!this.deps.indexingService) throw new Error("Indexing service is not configured");
    return this.deps.indexingService.indexRepository(input);
  }

  async updateRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput> {
    return this.indexRepository(input);
  }

  async getChunk(id: string): Promise<Chunk> {
    if (!this.deps.metadataStore) throw new Error("Metadata store is not configured");
    const chunk = await this.deps.metadataStore.getChunk(id);
    if (!chunk) throw new Error(`Chunk not found: ${id}`);
    return chunk;
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const mode = query.mode ?? "keyword";
    if (mode !== "keyword") {
      throw new Error(`Search mode ${mode} is not implemented in v1`);
    }
    return this.keywordSearch(query);
  }

  async keywordSearch(query: SearchQuery): Promise<SearchResult> {
    return this.deps.keywordStrategy.search({ ...query, mode: "keyword" });
  }

  async semanticSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("semantic", query);
  }

  async astSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("ast", query);
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("hybrid", query);
  }

  private unsupported(mode: SearchMode, _query: SearchQuery): never {
    throw new Error(`Search mode ${mode} is not implemented in v1`);
  }
}
```

Run existing core tests and update object construction only if TypeScript requires optional fields.

- [ ] **Step 2: Create adapter composition helper**

Create `packages/cli/src/createEngine.ts`:

```ts
import { SemanticContextEngine } from "@sce/core";
import { IndexingService } from "@sce/indexing";
import { MarkdownChunker } from "@sce/parsing";
import { SimpleRanker } from "@sce/ranking";
import { KeywordRetrievalStrategy } from "@sce/retrieval";
import { SqliteStorage } from "@sce/storage";

export async function createEngine(rootPath: string): Promise<{ engine: SemanticContextEngine; close: () => void }> {
  const storage = await SqliteStorage.open(rootPath);
  const ranker = new SimpleRanker();
  const keywordStrategy = new KeywordRetrievalStrategy({ keywordIndex: storage, ranker });
  const indexingService = new IndexingService({
    chunker: new MarkdownChunker(),
    metadataStore: storage,
    keywordIndex: storage
  });

  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      indexingService,
      metadataStore: storage
    }),
    close: () => storage.close()
  };
}
```

- [ ] **Step 3: Implement CLI**

Create `packages/cli/src/main.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { createEngine } from "./createEngine.js";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.name("sce");

  program
    .command("index")
    .argument("<path>")
    .option("--type <type>", "repository type", "vault")
    .action(async (path, options) => {
      const { engine, close } = await createEngine(path);
      try {
        const result = await engine.indexRepository({ rootPath: path, type: options.type });
        console.log(`Indexed ${result.filesIndexed} files and ${result.chunksIndexed} chunks`);
      } finally {
        close();
      }
    });

  program
    .command("update")
    .argument("<path>")
    .action(async (path) => {
      const { engine, close } = await createEngine(path);
      try {
        const result = await engine.updateRepository({ rootPath: path, type: "vault" });
        console.log(`Updated ${result.filesIndexed} files and ${result.chunksIndexed} chunks`);
      } finally {
        close();
      }
    });

  program
    .command("search")
    .argument("<query>")
    .requiredOption("--path <path>")
    .option("--limit <limit>", "maximum hit count", "10")
    .option("--json", "print JSON")
    .action(async (query, options) => {
      const { engine, close } = await createEngine(options.path);
      try {
        const result = await engine.search({ text: query, limit: Number(options.limit) });
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          for (const hit of result.hits) {
            console.log(`${hit.path}:${hit.startLine}-${hit.endLine} score=${hit.score}`);
            console.log(hit.snippet);
          }
        }
      } finally {
        close();
      }
    });

  program
    .command("chunk")
    .argument("<chunkId>")
    .requiredOption("--path <path>")
    .action(async (chunkId, options) => {
      const { engine, close } = await createEngine(options.path);
      try {
        const chunk = await engine.getChunk(chunkId);
        console.log(chunk.text);
      } finally {
        close();
      }
    });

  await program.parseAsync(argv, { from: "user" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

Modify `packages/cli/package.json`:

```json
{
  "name": "@sce/cli",
  "version": "0.0.0",
  "type": "module",
  "main": "dist/src/main.js",
  "types": "dist/src/main.d.ts",
  "bin": {
    "sce": "dist/src/main.js"
  },
  "dependencies": {
    "@sce/core": "0.0.0",
    "@sce/indexing": "0.0.0",
    "@sce/parsing": "0.0.0",
    "@sce/ranking": "0.0.0",
    "@sce/retrieval": "0.0.0",
    "@sce/storage": "0.0.0",
    "commander": "*"
  }
}
```

- [ ] **Step 4: Implement MCP tool handlers**

Create `packages/mcp/src/createEngine.ts`:

```ts
import { SemanticContextEngine } from "@sce/core";
import { IndexingService } from "@sce/indexing";
import { MarkdownChunker } from "@sce/parsing";
import { SimpleRanker } from "@sce/ranking";
import { KeywordRetrievalStrategy } from "@sce/retrieval";
import { SqliteStorage } from "@sce/storage";

export async function createEngine(rootPath: string): Promise<{ engine: SemanticContextEngine; close: () => void }> {
  const storage = await SqliteStorage.open(rootPath);
  const ranker = new SimpleRanker();
  const keywordStrategy = new KeywordRetrievalStrategy({ keywordIndex: storage, ranker });
  const indexingService = new IndexingService({
    chunker: new MarkdownChunker(),
    metadataStore: storage,
    keywordIndex: storage
  });

  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      indexingService,
      metadataStore: storage
    }),
    close: () => storage.close()
  };
}
```

Create `packages/mcp/src/tools.ts`:

```ts
import { createEngine } from "./createEngine.js";

export async function sceIndexRepository(input: { path: string; type?: "code" | "vault" }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.indexRepository({ rootPath: input.path, type: input.type ?? "vault" });
  } finally {
    close();
  }
}

export async function sceUpdateRepository(input: { path: string; type?: "code" | "vault" }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.updateRepository({ rootPath: input.path, type: input.type ?? "vault" });
  } finally {
    close();
  }
}

export async function sceSearch(input: { path: string; query: string; limit?: number; includeText?: boolean }) {
  const { engine, close } = await createEngine(input.path);
  try {
    const result = await engine.search({ text: input.query, limit: input.limit ?? 10 });
    if (!input.includeText) return result;
    const hits = await Promise.all(
      result.hits.map(async (hit) => ({ ...hit, text: (await engine.getChunk(hit.chunkId)).text }))
    );
    return { ...result, hits };
  } finally {
    close();
  }
}

export async function sceGetChunk(input: { path: string; chunkId: string }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.getChunk(input.chunkId);
  } finally {
    close();
  }
}
```

Create `packages/mcp/src/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sceGetChunk, sceIndexRepository, sceSearch, sceUpdateRepository } from "./tools.js";

const server = new McpServer({ name: "semantic-context-engine", version: "0.0.0" });

server.tool("sce_index_repository", { path: z.string(), type: z.enum(["code", "vault"]).optional() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceIndexRepository(input), null, 2) }]
}));

server.tool("sce_update_repository", { path: z.string(), type: z.enum(["code", "vault"]).optional() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceUpdateRepository(input), null, 2) }]
}));

server.tool("sce_search", { path: z.string(), query: z.string(), limit: z.number().optional(), includeText: z.boolean().optional() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceSearch(input), null, 2) }]
}));

server.tool("sce_get_chunk", { path: z.string(), chunkId: z.string() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceGetChunk(input), null, 2) }]
}));

await server.connect(new StdioServerTransport());
```

- [ ] **Step 5: Write adapter tests**

Create `packages/mcp/src/__tests__/tools.test.ts`:

```ts
import { mkdtemp, rm, cp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { sceIndexRepository, sceSearch } from "../tools.js";

describe("MCP tool handlers", () => {
  it("indexes and searches through core adapters", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-mcp-"));
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      const indexed = await sceIndexRepository({ path: dir, type: "vault" });
      expect(indexed.filesIndexed).toBe(3);

      const result = await sceSearch({ path: dir, query: "concise snippets", limit: 5 });
      expect(result.hits[0]?.path).toBe("Agent-Context.md");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 6: Run final vertical tests**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 7: Manual CLI smoke test**

Run:

```bash
npm run build
node packages/cli/dist/src/main.js index fixtures/sample-vault --type vault
node packages/cli/dist/src/main.js search "SQLite FTS5" --path fixtures/sample-vault --json
```

Expected: index command reports three files. Search JSON includes a hit for `Architecture.md`.

- [ ] **Step 8: Commit**

```bash
git add packages fixtures package.json package-lock.json
git commit -m "feat: expose vault search through cli and mcp"
```

---

## Self-Review Notes

Spec coverage:

- Monorepo package layout is covered in Task 1.
- Core public API, models, and plugin interfaces are covered in Task 2.
- Config, ignore rules, and quiet defaults are covered in Task 3.
- Markdown heading chunks and wiki-link metadata are covered in Task 4.
- Per-root `.sce/metadata.sqlite` and FTS5 are covered in Task 5.
- Vault indexing and incremental file-hash refresh behavior are covered in Task 6.
- Keyword retrieval and simple ranking are covered in Task 7.
- CLI and MCP adapters over the same core API are covered in Task 8.
- Testing strategy is embedded in every task with unit, integration, adapter, and smoke tests.

Known scope boundaries:

- `updateRepository` is implemented as hash-aware re-indexing in v1. This satisfies changed-file refresh without adding a file watcher.
- `statistics()` and `optimize()` from the design are not required for the first useful vertical and should be added in a later operations slice.
- `getFile(path)` is not required for the first useful vertical because `getChunk(id)` supplies full retrieved context.
- Semantic, AST, hybrid, embeddings, vector stores, graph traversal, web UI, and Cloudflare deployment are intentionally out of scope.
