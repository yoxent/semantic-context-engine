# SCE Semantic Search Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in semantic (embedding-based) search to SCE on top of the existing keyword vertical, without changing default keyword behavior: embed chunks during index/update, store vectors in SQLite behind `IVectorStore`, route `search({ mode: "semantic" })` / `semanticSearch()` through a `SemanticRetrievalStrategy`, and expose the new mode through CLI `--mode semantic` and MCP `mode`.

**Architecture:** Follow the existing package boundaries. `@sce/core` gains an `embedding` config block and routes semantic search to an injected strategy. `@sce/embedding` implements `OpenAICompatibleEmbeddingProvider` over `IEmbeddingProvider`. `@sce/storage` adds a SQLite-backed `SqliteVectorStore` implementing `IVectorStore`, reusing the same `.sce/metadata.sqlite` file via the existing `SqliteStorage` DB handle. `@sce/retrieval` adds `SemanticRetrievalStrategy` that embeds the query, searches vectors, hydrates chunks from `IMetadataStore`, shapes `SearchHit`s, and reuses `SimpleRanker`. `@sce/indexing` embeds changed/deleted chunks during index/update when semantic is configured. `@sce/runtime` wires semantic components only when `embedding` is present. CLI and MCP stay thin.

**Tech Stack:** TypeScript, Node.js 20+, npm workspaces, Vitest, `better-sqlite3`, `zod`, the global `fetch` API (Node 20+), and the existing `@modelcontextprotocol/sdk` / `commander` adapters.

## Global Constraints

- Work only on branch `develop`. Do not commit to `main` (production-only).
- Semantic search is opt-in via `sce.config.json` `embedding` block. Without it, keyword-only behavior must be byte-for-byte unchanged.
- Pasttime must remain untouched: no imports, shared packages, links, or product coupling. Do not reference Pasttime in code.
- Keep CLI and MCP as thin adapters over `@sce/runtime`/`@sce/core`; they must not own embedding, storage, ranking, or retrieval logic.
- Vectors for this slice live in the existing `.sce/metadata.sqlite` behind `IVectorStore`. Do NOT implement the future `.sce/semantic/` layout (`embeddings.bin`, `vector.index`) — document it as future work only.
- Embedding happens during `index`/`update`, never lazily during search.
- `repositoryIds` must be honored by semantic search. `pathFilter` and `language` remain keyword-only; if used with `mode: "semantic"`, throw a clear unsupported-filter error rather than silently ignoring.
- Model or `dimensions` change is a rebuild boundary: fail clearly rather than mixing vectors.
- If semantic is configured and the provider is unreachable during index/update, fail hard with a clear error.
- Reuse `SimpleRanker`; no ranking redesign.
- Use TDD for each task. Run `npm test`, `npm run typecheck`, and `npm run build` green before each commit. Commit on `develop` after every task.
- Do not start implementation until the plan has been reviewed and you are explicitly asked.

## Non-Goals

- No hybrid result merging.
- No `ast` mode implementation.
- No binary vector file format, ANN index, or external vector database.
- No cloud-only embedding provider (only OpenAI-compatible HTTP, suitable for local Ollama / LM Studio).
- No semantic ranking redesign beyond reusing `SimpleRanker`.
- No web UI, no Obsidian-like UI.
- No new `sce.config.json` schema for providers other than `openai-compatible`.
- No changes to Pasttime.
- No lazy/on-search embedding.

---

## File Structure

Create and modify this structure across the implementation:

```text
packages/core/src/config/schema.ts                      # Modify: add embedding schema
packages/core/src/config/defaults.ts                     # Modify: default batchSize
packages/core/src/config/loadConfig.test.ts              # Modify: cover embedding
packages/core/src/interfaces/VectorStore.ts             # Modify: add model/dimensions/repoId metadata to upsert + schema-validation surface
packages/core/src/api/SemanticContextEngine.ts          # Modify: route semantic mode
packages/core/src/api/SemanticContextEngine.test.ts     # Modify: semantic routing tests
packages/core/src/index.ts                              # (no change expected; VectorStore already exported)

packages/embedding/src/index.ts                          # Modify: export provider
packages/embedding/src/OpenAICompatibleEmbeddingProvider.ts      # Create
packages/embedding/src/__tests__/OpenAICompatibleEmbeddingProvider.test.ts  # Create
packages/embedding/package.json                          # Modify: not needed if no new deps (uses global fetch)

packages/storage/src/SqliteVectorStore.ts                # Create
packages/storage/src/vectorSchema.ts                     # Create: extra vector SQL for reuse in schema bootstrap
packages/storage/src/SqliteStorage.ts                    # Modify: expose shared DB + run vector schema; close vector store
packages/storage/src/schema.ts                           # Modify: add vectors table SQL
packages/storage/src/index.ts                            # Modify: export SqliteVectorStore
packages/storage/src/__tests__/SqliteVectorStore.test.ts # Create

packages/retrieval/src/SemanticRetrievalStrategy.ts      # Create
packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts  # Create
packages/retrieval/src/index.ts                           # Modify: export SemanticRetrievalStrategy
packages/retrieval/package.json                           # Modify: depends on @sce/storage? No — core interfaces only.

packages/indexing/src/Indexer.ts                         # Modify: embed + vector upsert/delete
packages/indexing/src/__tests__/Indexer.test.ts          # Modify: semantic embedding tests
packages/indexing/package.json                           # Modify: add @sce/embedding dep (optional at runtime)

packages/runtime/src/createEngine.ts                     # Modify: wire semantic when configured
packages/runtime/src/__tests__/createEngine.test.ts      # Modify: semantic wiring tests
packages/runtime/package.json                            # Modify: add @sce/embedding dep

packages/cli/src/main.ts                                 # Modify: --mode option + semantic error surfacing
packages/cli/src/__tests__/main.test.ts                  # Modify: semantic mode test

packages/mcp/src/tools.ts                                # Modify: mode field passthrough + semantic error surfacing
packages/mcp/src/server.ts                               # Modify: add mode to sce_search schema
packages/mcp/src/__tests__/tools.test.ts                 # Modify: semantic mode test

README.md                                                # Modify: document embedding config + semantic CLI/MCP
HANDOFF.md                                               # Modify: record slice shipped + follow-ups
docs/superpowers/specs/2026-07-13-sce-semantic-search-slice-design.md   # No change (source of truth)
```

Responsibilities:
- `OpenAICompatibleEmbeddingProvider`: HTTP client only. Batches texts, POSTs to `${baseUrl}/embeddings`, validates shape, returns `number[][]`. Knows nothing about chunks, repositories, storage, ranking.
- `SqliteVectorStore`: persists vectors in `.sce/metadata.sqlite` table `vectors`, keyed by `(repository_id, chunk_id)`, storing `model`, `dimensions`, JSON `vector`, `updated_at`. Computes cosine similarity in process with repository filtering. Validates dimensions on upsert and search.
- `SemanticRetrievalStrategy`: embeds `query.text`, rejects `pathFilter`/`language`, calls `IVectorStore.search`, hydrates chunk ids through a new `IMetadataStore` list method, shapes `SearchHit`, applies `SimpleRanker`, returns `SearchResult` with semantic diagnostics.
- `IndexingService`: after metadata/FTS writes, when an embedding provider + vector store are configured, embeds changed chunks, upserts vectors, and deletes vectors for pruned/replaced files. Validates rebuild boundary (model/dimensions mismatch).
- `createEngine`: reads `config.embedding`; when present, builds provider + vector store + semantic strategy and injects into engine. When absent, builds the current keyword-only engine unchanged.
- CLI/MCP: add `mode` option; default `keyword`; pass to `engine.search`; surface semantic errors clearly.

---

## Task 1: Core config schema and defaults for `embedding`

**Files:**
- Modify: `packages/core/src/config/schema.ts`
- Modify: `packages/core/src/config/defaults.ts`
- Modify: `packages/core/src/config/loadConfig.ts`
- Test: `packages/core/src/config/loadConfig.test.ts`

**Interfaces:**
- Consumes: existing `sceConfigSchema`, `defaultConfig`.
- Produces: a new typed `EmbeddingConfig` shape on `SceConfig`. Later tasks reference `config.embedding?.provider`, `config.embedding?.baseUrl`, `config.embedding?.model`, `config.embedding?.dimensions`, `config.embedding?.batchSize`, `config.embedding?.apiKeyEnv`.

- [ ] **Step 1: Write failing tests for embedding config parsing**

Append to `packages/core/src/config/loadConfig.test.ts` (after existing tests):

```ts
import { sceConfigSchema } from "../schema.js";

describe("embedding config", () => {
  it("parses a valid embedding block with defaults", () => {
    const parsed = sceConfigSchema.parse({
      embedding: {
        provider: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        model: "nomic-embed-text",
        dimensions: 768
      }
    });
    expect(parsed.embedding).toEqual({
      provider: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      dimensions: 768,
      batchSize: 32,
      apiKeyEnv: undefined
    });
  });

  it("applies batchSize default and accepts apiKeyEnv", () => {
    const parsed = sceConfigSchema.parse({
      embedding: {
        provider: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        model: "nomic-embed-text",
        dimensions: 768,
        apiKeyEnv: "OPENAI_API_KEY"
      }
    });
    expect(parsed.embedding?.batchSize).toBe(32);
    expect(parsed.embedding?.apiKeyEnv).toBe("OPENAI_API_KEY");
  });

  it("rejects unknown provider values", () => {
    expect(() =>
      sceConfigSchema.parse({
        embedding: { provider: "vertex", baseUrl: "x", model: "m", dimensions: 768 }
      })
    ).toThrow();
  });

  it("requires dimensions, baseUrl, and model when embedding block present", () => {
    expect(() => sceConfigSchema.parse({ embedding: { provider: "openai-compatible" } })).toThrow();
  });

  it("treats embedding as optional absent", () => {
    expect(sceConfigSchema.parse({}).embedding).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/config/loadConfig.test.ts`
Expected: FAIL — `parsed.embedding` is `undefined` because schema has no `embedding` field yet.

- [ ] **Step 3: Add the `embedding` schema**

Modify `packages/core/src/config/schema.ts`:

```ts
import { z } from "zod";

export const repositoryConfigSchema = z.object({
  path: z.string(),
  type: z.enum(["code", "vault"]),
  name: z.string().optional()
});

export const embeddingConfigSchema = z.object({
  provider: z.literal("openai-compatible"),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  dimensions: z.number().int().positive(),
  batchSize: z.number().int().positive().default(32),
  apiKeyEnv: z.string().optional()
});

export type EmbeddingConfig = z.infer<typeof embeddingConfigSchema>;

export const sceConfigSchema = z.object({
  repositories: z.array(repositoryConfigSchema).default([]),
  indexing: z
    .object({
      include: z.array(z.string()).default(["**/*.md"]),
      ignore: z.array(z.string()).default([])
    })
    .default({ include: ["**/*.md"], ignore: [] }),
  search: z
    .object({
      defaultLimit: z.number().int().positive().default(10),
      maxSnippetChars: z.number().int().positive().default(500)
    })
    .default({ defaultLimit: 10, maxSnippetChars: 500 }),
  logging: z
    .object({
      level: z.enum(["silent", "error", "warn", "info", "debug"]).default("info")
    })
    .default({ level: "info" }),
  embedding: embeddingConfigSchema.optional()
});

export type SceConfig = z.infer<typeof sceConfigSchema>;
```

- [ ] **Step 4: Surface embedding in loadConfig defaults**

Modify `packages/core/src/config/loadConfig.ts` so the returned object includes the parsed `embedding` block. In the returned object literal, add:

```ts
embedding: parsed.embedding
```

(Add this field next to the existing `repositories`, `indexing`, `search`, `logging` fields. Do not add defaults — `embedding` is optional and the schema sets `batchSize`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/config/loadConfig.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: All green. Existing keyword tests unchanged (no `embedding` block).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/config/schema.ts packages/core/src/config/loadConfig.ts packages/core/src/config/loadConfig.test.ts
git commit -m "feat(core): add optional embedding config schema"
```

---

## Task 2: Expand `IVectorStore` metadata for repository, model, and dimensions

**Files:**
- Modify: `packages/core/src/interfaces/VectorStore.ts`

**Interfaces:**
- Consumes: existing `IVectorStore`.
- Produces: `VectorUpsert` and updated `IVectorStore` signatures. Later tasks call `upsert({ chunkId, repositoryId, model, dimensions, vector })`, `search({ repositoryIds?, vector, limit, model, dimensions })`, `deleteByChunk(chunkId)`, `deleteByRepository(repositoryId)`, `deleteByFile(repositoryId, relativePath)`, and `getModelDimensions(repositoryId)`.

- [ ] **Step 1: Write the failing test against the interface shape**

Create `packages/core/src/interfaces/__tests__/VectorStore.contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { IVectorStore } from "../VectorStore.js";

describe("IVectorStore contract", () => {
  it("supports repository/model/dimensions metadata on upsert and search", () => {
    const store: IVectorStore = {
      upsert: async () => undefined,
      search: async () => [],
      deleteByChunk: async () => undefined,
      deleteByRepository: async () => undefined,
      deleteByFile: async () => undefined,
      getModelDimensions: async () => undefined
    };
    expect(typeof store.upsert).toBe("function");
    expect(typeof store.search).toBe("function");
    expect(typeof store.deleteByChunk).toBe("function");
    expect(typeof store.getModelDimensions).toBe("function");
  });
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npx vitest run packages/core/src/interfaces/__tests__/VectorStore.contract.test.ts`
Expected: FAIL — `deleteByChunk` etc. not in interface.

- [ ] **Step 3: Replace the interface**

Modify `packages/core/src/interfaces/VectorStore.ts`:

```ts
export interface VectorUpsert {
  chunkId: string;
  repositoryId: string;
  model: string;
  dimensions: number;
  vector: number[];
}

export interface VectorSearchQuery {
  repositoryIds?: string[];
  vector: number[];
  limit: number;
  model: string;
  dimensions: number;
}

export interface VectorSearchHit {
  chunkId: string;
  score: number;
}

export interface ModelDimensions {
  model: string;
  dimensions: number;
}

export interface IVectorStore {
  upsert(entry: VectorUpsert): Promise<void>;
  search(query: VectorSearchQuery): Promise<VectorSearchHit[]>;
  deleteByChunk(chunkId: string): Promise<void>;
  deleteByRepository(repositoryId: string): Promise<void>;
  deleteByFile(repositoryId: string, relativePath: string): Promise<void>;
  /** Returns the model+dimensions currently stored for a repository, or undefined if none. */
  getModelDimensions(repositoryId: string): Promise<ModelDimensions | undefined>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/interfaces/__tests__/VectorStore.contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: typecheck FAILS — `SqliteVectorStore` does not exist yet (nothing implements `IVectorStore`, so this is a no-op for compile). If any other code referenced the old `upsert(chunkId, vector)` signature, fix it. (Search shows no implementors yet.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/interfaces/VectorStore.ts packages/core/src/interfaces/__tests__/VectorStore.contract.test.ts
git commit -m "feat(core): expand IVectorStore with repository/model/dimensions metadata"
```

---

## Task 3: `OpenAICompatibleEmbeddingProvider`

**Files:**
- Create: `packages/embedding/src/OpenAICompatibleEmbeddingProvider.ts`
- Modify: `packages/embedding/src/index.ts`
- Create: `packages/embedding/src/__tests__/OpenAICompatibleEmbeddingProvider.test.ts`

**Interfaces:**
- Consumes: `IEmbeddingProvider` from `@sce/core`.
- Produces: `OpenAICompatibleEmbeddingProvider` constructor `(config: EmbeddingProviderConfig)` where `EmbeddingProviderConfig = { baseUrl: string; model: string; dimensions: number; batchSize: number; apiKeyEnv?: string }`, and a static helper `createEmbeddingProvider(config: EmbeddingConfig): IEmbeddingProvider` (imported from `@sce/core`). `embed(texts: string[]): Promise<number[][]>`.

- [ ] **Step 1: Write failing tests for request, batching, and error handling**

Create `packages/embedding/src/__tests__/OpenAICompatibleEmbeddingProvider.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { OpenAICompatibleEmbeddingProvider } from "../OpenAICompatibleEmbeddingProvider.js";

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TEST_KEY;
});

const baseConfig = {
  baseUrl: "http://localhost:11434/v1",
  model: "nomic-embed-text",
  dimensions: 3,
  batchSize: 2
};

describe("OpenAICompatibleEmbeddingProvider", () => {
  it("POSTs a single batch and returns vectors in order", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }] }));

    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    const result = await provider.embed(["alpha", "beta"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:11434/v1/embeddings");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload).toEqual({ model: "nomic-embed-text", input: ["alpha", "beta"] });
    expect(result).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6]
    ]);
  });

  it("splits texts into batchSize batches and concatenates results in order", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, _init) =>
      mockResponse({ data: [{ embedding: [1, 1, 1] }, { embedding: [2, 2, 2] }] })
    );

    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    const result = await provider.embed(["a", "b", "c", "d", "e"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(5);
    expect(result.map((v) => v[0])).toEqual([1, 2, 1, 2, 1]);
  });

  it("throws a clear error on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ error: "boom" }, 503));
    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    await expect(provider.embed(["x"])).rejects.toThrow(/503/);
  });

  it("throws on malformed response payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ data: [{ not_embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    await expect(provider.embed(["x"])).rejects.toThrow(/embedding/i);
  });

  it("rejects when the returned vector dimensions do not match config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ data: [{ embedding: [1, 2] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig); // dimensions = 3
    await expect(provider.embed(["x"])).rejects.toThrow(/dimension/i);
  });

  it("sends a bearer token from the apiKeyEnv environment variable when set", async () => {
    process.env.TEST_KEY = "secret-token";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ data: [{ embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, apiKeyEnv: "TEST_KEY" });
    await provider.embed(["x"]);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/embedding/src/__tests__/OpenAICompatibleEmbeddingProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider**

Create `packages/embedding/src/OpenAICompatibleEmbeddingProvider.ts`:

```ts
import type { IEmbeddingProvider, EmbeddingConfig } from "@sce/core";

export interface EmbeddingProviderConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  batchSize: number;
  apiKeyEnv?: string;
}

interface EmbeddingResponseRow {
  embedding?: unknown;
}

interface EmbeddingResponse {
  data?: EmbeddingResponseRow[];
}

export class OpenAICompatibleEmbeddingProvider implements IEmbeddingProvider {
  constructor(private readonly config: EmbeddingProviderConfig) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const vectors = await this.embedBatch(batch);
      out.push(...vectors);
    }
    return out;
  }

  private async embedBatch(batch: string[]): Promise<number[][]> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKeyEnv) {
      const token = process.env[this.config.apiKeyEnv];
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const url = joinUrl(this.config.baseUrl, "/embeddings");
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.config.model, input: batch })
    });

    if (!res.ok) {
      throw new Error(`Embedding provider request failed: HTTP ${res.status} from ${url}`);
    }

    let body: EmbeddingResponse;
    try {
      body = (await res.json()) as EmbeddingResponse;
    } catch {
      throw new Error(`Embedding provider returned malformed JSON from ${url}`);
    }

    if (!body || !Array.isArray(body.data) || body.data.length !== batch.length) {
      throw new Error("Embedding provider response missing 'data' array of expected length");
    }

    return body.data.map((row, index) => {
      const vector = row?.embedding;
      if (!Array.isArray(vector) || vector.some((v) => typeof v !== "number")) {
        throw new Error(`Embedding provider response entry ${index} is missing a numeric embedding array`);
      }
      if (vector.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${vector.length} (entry ${index})`
        );
      }
      return vector as number[];
    });
  }
}

export function createEmbeddingProvider(config: EmbeddingConfig): IEmbeddingProvider {
  return new OpenAICompatibleEmbeddingProvider({
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
    batchSize: config.batchSize,
    apiKeyEnv: config.apiKeyEnv
  });
}

function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/$/, "")}${suffix}`;
}
```

Modify `packages/embedding/src/index.ts`:

```ts
export * from "./OpenAICompatibleEmbeddingProvider.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/embedding/src/__tests__/OpenAICompatibleEmbeddingProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/embedding/src packages/embedding/package.json
git commit -m "feat(embedding): add OpenAI-compatible embedding provider"
```

---

## Task 4: `SqliteVectorStore` — schema + upsert + getModelDimensions + dimension mismatch

**Files:**
- Modify: `packages/storage/src/schema.ts`
- Create: `packages/storage/src/SqliteVectorStore.ts`
- Modify: `packages/storage/src/SqliteStorage.ts`
- Modify: `packages/storage/src/index.ts`
- Create: `packages/storage/src/__tests__/SqliteVectorStore.test.ts`

**Interfaces:**
- Consumes: `IVectorStore`, `VectorUpsert`, `VectorSearchQuery`, `VectorSearchHit`, `ModelDimensions` from `@sce/core`; the shared `better-sqlite3` `Database` handle exposed by `SqliteStorage`.
- Produces: `SqliteVectorStore` constructor `(db: Database.Database)`; static `SqliteVectorStore.attach(db)`; methods per `IVectorStore`.

- [ ] **Step 1: Write failing tests for upsert, getModelDimensions, and dimension mismatch**

Create `packages/storage/src/__tests__/SqliteVectorStore.test.ts`:

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { SqliteStorage } from "../SqliteStorage.js";
import { SqliteVectorStore } from "../SqliteVectorStore.js";

async function openStores(dir: string) {
  const storage = await SqliteStorage.open(dir);
  // Reuse the same DB connection that SqliteStorage opened — the vectors
  // table is created by createSchemaSql during SqliteStorage.open.
  const vectors = SqliteVectorStore.attach(storage.getDatabase());
  return { storage, vectors };
}

describe("SqliteVectorStore upsert + getModelDimensions", () => {
  it("upserts a vector and reports its model+dimensions for the repository", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    let storage: SqliteStorage | undefined;
    try {
      const stores = await openStores(dir);
      storage = stores.storage;
      await stores.vectors.upsert({
        chunkId: "c1",
        repositoryId: "repo-a",
        model: "nomic-embed-text",
        dimensions: 3,
        vector: [0.1, 0.2, 0.3]
      });

      const md = await stores.vectors.getModelDimensions("repo-a");
      expect(md).toEqual({ model: "nomic-embed-text", dimensions: 3 });
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("rejects upsert when vector length does not match dimensions field", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    try {
      const { storage, vectors } = await openStores(dir);
      await expect(
        vectors.upsert({ chunkId: "c2", repositoryId: "repo-a", model: "m", dimensions: 3, vector: [1, 2] })
      ).rejects.toThrow(/dimension/i);
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });

  it("replaces an existing vector for the same chunk on re-upsert", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    try {
      const { storage, vectors } = await openStores(dir);
      await vectors.upsert({ chunkId: "c1", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [1, 2] });
      await vectors.upsert({ chunkId: "c1", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [3, 4] });
      const hits = await vectors.search({ vector: [3, 4], limit: 5, model: "m", dimensions: 2, repositoryIds: ["repo-a"] });
      expect(hits).toHaveLength(1);
      expect(hits[0]?.chunkId).toBe("c1");
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/storage/src/__tests__/SqliteVectorStore.test.ts`
Expected: FAIL — `SqliteVectorStore` module not found.

- [ ] **Step 3: Add the vectors table SQL to the schema**

Modify `packages/storage/src/schema.ts` so `createSchemaSql` includes, appended after the existing tables (inside the same template literal):

```sql

CREATE TABLE IF NOT EXISTS vectors (
  repository_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (repository_id, chunk_id)
);
```

- [ ] **Step 4: Expose the shared DB handle from SqliteStorage**

Modify `packages/storage/src/SqliteStorage.ts`: add a public accessor returning the underlying DB so `SqliteVectorStore` reuses the same connection and the same `.sce/metadata.sqlite` file.

Add near the bottom of the class:

```ts
  /** Shared DB handle for sibling stores that reuse this connection (e.g. vector store). */
  getDatabase(): Database.Database {
    return this.db;
  }
```

- [ ] **Step 5: Implement SqliteVectorStore (upsert + getModelDimensions only this step; search/delete added later)**

Create `packages/storage/src/SqliteVectorStore.ts`:

```ts
import type { Database } from "better-sqlite3";
import type { IVectorStore, ModelDimensions, VectorSearchHit, VectorSearchQuery, VectorUpsert } from "@sce/core";

export class SqliteVectorStore implements IVectorStore {
  constructor(private readonly db: Database.Database) {}

  static attach(db: Database.Database): SqliteVectorStore {
    return new SqliteVectorStore(db);
  }

  async upsert(entry: VectorUpsert): Promise<void> {
    if (entry.vector.length !== entry.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${entry.dimensions}, got ${entry.vector.length} (chunk ${entry.chunkId})`
      );
    }
    this.db
      .prepare(
        `INSERT OR REPLACE INTO vectors (repository_id, chunk_id, relative_path, model, dimensions, vector, updated_at)
         VALUES (@repositoryId, @chunkId, @relativePath, @model, @dimensions, @vector, @updatedAt)`
      )
      .run({
        repositoryId: entry.repositoryId,
        chunkId: entry.chunkId,
        relativePath: entry.relativePath,
        model: entry.model,
        dimensions: entry.dimensions,
        vector: JSON.stringify(entry.vector),
        updatedAt: new Date().toISOString()
      });
  }

  async search(query: VectorSearchQuery): Promise<VectorSearchHit[]> {
    return cosineSearch(this.db, query);
  }

  async deleteByChunk(chunkId: string): Promise<void> {
    this.db.prepare("DELETE FROM vectors WHERE chunk_id = ?").run(chunkId);
  }

  async deleteByRepository(repositoryId: string): Promise<void> {
    this.db.prepare("DELETE FROM vectors WHERE repository_id = ?").run(repositoryId);
  }

  async deleteByFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db.prepare("DELETE FROM vectors WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
  }

  async getModelDimensions(repositoryId: string): Promise<ModelDimensions | undefined> {
    const row = this.db
      .prepare("SELECT model, dimensions FROM vectors WHERE repository_id = ? LIMIT 1")
      .get(repositoryId) as { model: string; dimensions: number } | undefined;
    if (!row) return undefined;
    return { model: row.model, dimensions: row.dimensions };
  }
}

export function cosineSearch(db: Database.Database, query: VectorSearchQuery): VectorSearchHit[] {
  if (query.vector.length !== query.dimensions) {
    throw new Error(
      `Embedding dimension mismatch: expected ${query.dimensions}, got ${query.vector.length} (query vector)`
    );
  }
  const repositoryClause =
    query.repositoryIds && query.repositoryIds.length > 0
      ? `AND repository_id IN (${query.repositoryIds.map(() => "?").join(", ")})`
      : "";
  const params: unknown[] = [...(query.repositoryIds ?? [])];
  const rows = db
    .prepare(
      `SELECT chunk_id, vector, model, dimensions FROM vectors WHERE 1=1 ${repositoryClause}`
    )
    .all(...params) as { chunk_id: string; vector: string; model: string; dimensions: number }[];

  const queryNorm = norm(query.vector);
  if (queryNorm === 0) return [];

  const scored = rows
    .filter((row) => row.model === query.model && row.dimensions === query.dimensions)
    .map((row) => {
      const candidate = JSON.parse(row.vector) as number[];
      if (candidate.length !== query.dimensions) return null;
      const dot = dotProduct(query.vector, candidate);
      const candidateNorm = norm(candidate);
      if (candidateNorm === 0) return null;
      return { chunkId: row.chunk_id, score: dot / (queryNorm * candidateNorm) };
    })
    .filter((hit): hit is VectorSearchHit => hit !== null);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, query.limit);
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

function norm(a: number[]): number {
  return Math.sqrt(dotProduct(a, a));
}
```

> Note: `VectorUpsert` (Task 2) currently does NOT include `relativePath`. Add it in this step by editing `packages/core/src/interfaces/VectorStore.ts` `VectorUpsert` to include `relativePath: string;` (the indexer in Task 8 will supply it). Update the contract test in Task 2 to set `relativePath` if you already merged that test — but since Task 2 already committed, the contract test only checks method existence, so no edit needed.

Modify `packages/storage/src/index.ts`:

```ts
export * from "./SqliteStorage.js";
export * from "./SqliteVectorStore.js";
export * from "./schema.js";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run packages/storage/src/__tests__/SqliteVectorStore.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. Existing SqliteStorage tests unchanged (vectors table now also created on open, harmless).

- [ ] **Step 8: Commit**

```bash
git add packages/storage/src packages/core/src/interfaces/VectorStore.ts
git commit -m "feat(storage): add SqliteVectorStore with upsert and cosine search"
```

---

## Task 5: `SqliteVectorStore` search ordering, repository filtering, and delete behavior

**Files:**
- Modify: `packages/storage/src/SqliteVectorStore.ts` (only if test gaps surface)
- Modify: `packages/storage/src/__tests__/SqliteVectorStore.test.ts`

**Interfaces:**
- Consumes: `IVectorStore.search`, `deleteByChunk`, `deleteByRepository`, `deleteByFile`.
- Produces: cosine-sorted, repository-filtered `VectorSearchHit[]`; delete helpers used by indexer in Task 8.

- [ ] **Step 1: Write failing tests for search ordering and deletes**

Append to `packages/storage/src/__tests__/SqliteVectorStore.test.ts`:

```ts
describe("SqliteVectorStore search ordering and deletes", () => {
  it("orders hits by cosine similarity and respects repositoryIds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    try {
      const { storage, vectors } = await openStores(dir);
      await vectors.upsert({ chunkId: "a", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [0.0, 1.0], relativePath: "a.md" });
      await vectors.upsert({ chunkId: "b", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [1.0, 1.0], relativePath: "b.md" });
      await vectors.upsert({ chunkId: "c", repositoryId: "repo-b", model: "m", dimensions: 2, vector: [1.0, 0.0], relativePath: "c.md" });

      const hits = await vectors.search({ vector: [1.0, 1.0], limit: 10, model: "m", dimensions: 2, repositoryIds: ["repo-a"] });
      expect(hits.map((h) => h.chunkId)).toEqual(["b", "a"]);
      const all = await vectors.search({ vector: [1.0, 1.0], limit: 10, model: "m", dimensions: 2 });
      expect(all.map((h) => h.chunkId)).toEqual(["b", "c", "a"]);
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });

  it("deletes by chunk, repository, and file path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    try {
      const { storage, vectors } = await openStores(dir);
      await vectors.upsert({ chunkId: "a", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [0, 1], relativePath: "a.md" });
      await vectors.upsert({ chunkId: "b", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [0, 1], relativePath: "b.md" });
      await vectors.upsert({ chunkId: "c", repositoryId: "repo-b", model: "m", dimensions: 2, vector: [0, 1], relativePath: "c.md" });

      await vectors.deleteByChunk("a");
      await vectors.deleteByFile("repo-a", "b.md");
      await vectors.deleteByRepository("repo-b");

      const remaining = await vectors.search({ vector: [0, 1], limit: 10, model: "m", dimensions: 2 });
      expect(remaining).toHaveLength(0);
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });

  it("ignores rows whose stored model or dimensions do not match the query", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    try {
      const { storage, vectors } = await openStores(dir);
      await vectors.upsert({ chunkId: "a", repositoryId: "repo-a", model: "old-model", dimensions: 2, vector: [0, 1], relativePath: "a.md" });
      const hits = await vectors.search({ vector: [0, 1], limit: 10, model: "new-model", dimensions: 2, repositoryIds: ["repo-a"] });
      expect(hits).toHaveLength(0);
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail/pass appropriately**

Run: `npx vitest run packages/storage/src/__tests__/SqliteVectorStore.test.ts`
Expected: PASS (implementation already provided in Task 4). If any case fails, fix the implementation in `cosineSearch` — likely the model/dimensions filter. Do not change the test expectations.

- [ ] **Step 3: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/storage/src/__tests__/SqliteVectorStore.test.ts
git commit -m "test(storage): cover vector search ordering and deletes"
```

---

## Task 6: `IMetadataStore.getChunks` for hydrating vector hits

**Files:**
- Modify: `packages/core/src/interfaces/Storage.ts`
- Modify: `packages/storage/src/SqliteStorage.ts`

**Interfaces:**
- Consumes: `Chunk`, `IMetadataStore`.
- Produces: `IMetadataStore.getChunks(ids: string[]): Promise<Chunk[]>` (order not guaranteed; caller maps by id).

- [ ] **Step 1: Write the failing test**

Append to `packages/storage/src/__tests__/SqliteStorage.test.ts`:

```ts
describe("SqliteStorage.getChunks", () => {
  it("returns multiple chunks by id in a single call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      await storage.saveChunks([
        makeChunk({ id: "chunk-1", relativePath: "a.md" }),
        makeChunk({ id: "chunk-2", relativePath: "b.md" })
      ]);
      const chunks = await storage.getChunks(["chunk-1", "chunk-2", "missing"]);
      expect(chunks.map((c) => c.id).sort()).toEqual(["chunk-1", "chunk-2"]);
      expect(chunks.length).toBe(2);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/storage/src/__tests__/SqliteStorage.test.ts`
Expected: FAIL — `getChunks` is not a function.

- [ ] **Step 3: Add interface method**

Modify `packages/core/src/interfaces/Storage.ts` `IMetadataStore` to add:

```ts
  getChunks(ids: string[]): Promise<Chunk[]>;
```

- [ ] **Step 4: Implement getChunks in SqliteStorage**

Add to `packages/storage/src/SqliteStorage.ts`:

```ts
  async getChunks(ids: string[]): Promise<Chunk[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM chunks WHERE id IN (${placeholders})`)
      .all(...ids) as any[];
    return rows.map(fromChunkRow);
  }
```

There is already a `fromChunkRow` module-private function near the bottom of the file; reuse it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/storage/src/__tests__/SqliteStorage.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. Existing engine test that hand-rolls a `metadataStore` does not define `getChunks` only if it is typed as the full interface — if typecheck fails on the in-memory mock in `SemanticContextEngine.test.ts`, add `getChunks: async () => []` to that mock object.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/interfaces/Storage.ts packages/storage/src/SqliteStorage.ts packages/storage/src/__tests__/SqliteStorage.test.ts packages/core/src/api/SemanticContextEngine.test.ts
git commit -m "feat(storage): add getChunks for vector hit hydration"
```

---

## Task 7: `SemanticRetrievalStrategy`

**Files:**
- Create: `packages/retrieval/src/SemanticRetrievalStrategy.ts`
- Modify: `packages/retrieval/src/index.ts`
- Create: `packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts`

**Interfaces:**
- Consumes: `IRetrievalStrategy`, `SearchQuery`, `SearchResult`, `SearchHit` from `@sce/core`; `IEmbeddingProvider`; `IVectorStore`; `IMetadataStore`; `IRanker`.
- Produces: `SemanticRetrievalStrategy` constructor `(deps: SemanticRetrievalStrategyDeps)` where `SemanticRetrievalStrategyDeps = { embeddingProvider: IEmbeddingProvider; vectorStore: IVectorStore; metadataStore: IMetadataStore; ranker: IRanker; model: string; dimensions: number }`. `name = "semantic"`.

- [ ] **Step 1: Write failing tests**

Create `packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SemanticRetrievalStrategy } from "../SemanticRetrievalStrategy.js";
import type { Chunk, IEmbeddingProvider, IMetadataStore, IRanker, IVectorStore, SearchQuery } from "@sce/core";

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "chunk-1",
    repositoryId: "repo-a",
    relativePath: "Notes/Alpha.md",
    language: "markdown",
    startLine: 1,
    endLine: 4,
    text: "# Alpha\nSemantic notes about vectors.",
    fileHash: "h",
    timestamp: new Date("2026-07-13T00:00:00.000Z"),
    headingPath: ["Alpha"],
    ...overrides
  };
}

const embedding: IEmbeddingProvider = {
  embed: async (texts: string[]) => texts.map(() => [0.0, 1.0])
};

const vectorStore: IVectorStore = {
  upsert: async () => undefined,
  search: async (q) =>
    q.vector[1] === 1
      ? [{ chunkId: "chunk-1", score: 0.9 }, { chunkId: "chunk-2", score: 0.7 }]
      : [],
  deleteByChunk: async () => undefined,
  deleteByRepository: async () => undefined,
  deleteByFile: async () => undefined,
  getModelDimensions: async () => ({ model: "m", dimensions: 2 })
};

const metadataStore: IMetadataStore = {
  saveRepository: async () => undefined,
  getRepository: async () => undefined,
  deleteRepository: async () => undefined,
  saveFile: async () => undefined,
  getFile: async () => undefined,
  listFiles: async () => [],
  deleteFile: async () => undefined,
  saveChunks: async () => undefined,
  getChunk: async () => undefined,
  getChunks: async (ids) => [makeChunk({ id: ids[0] ?? "chunk-1" })],
  deleteChunksForFile: async () => undefined,
  getStatistics: async () => ({
    repositoryCount: 0,
    fileCount: 0,
    chunkCount: 0,
    linkCount: 0,
    repositories: []
  })
};

const ranker: IRanker = {
  rank: (hits, _query) => hits.map((hit) => ({ ...hit, score: hit.score + 2 }))
};

describe("SemanticRetrievalStrategy", () => {
  it("embeds the query, searches vectors, hydrates chunks, and ranks", async () => {
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 10,
      maxSnippetChars: 500
    });
    const result = await strategy.search({ text: "vectors", limit: 5 });

    expect(result.diagnostics?.strategy).toBe("semantic");
    expect(result.hits[0]?.chunkId).toBe("chunk-1");
    expect(result.hits[0]?.strategy).toBe("semantic");
    expect(result.hits[0]?.path).toBe("Notes/Alpha.md");
    expect(result.hits[0]?.headingPath).toEqual(["Alpha"]);
    // ranker added +2
    expect(result.hits[0]?.score).toBeCloseTo(0.9 + 2, 6);
  });

  it("rejects pathFilter and language with a clear unsupported-filter error", async () => {
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 10,
      maxSnippetChars: 500
    });
    await expect(strategy.search({ text: "x", pathFilter: "notes/*" })).rejects.toThrow(/pathFilter.*semantic|semantic.*pathFilter/i);
    await expect(strategy.search({ text: "x", language: "markdown" })).rejects.toThrow(/language.*semantic|semantic.*language/i);
  });

  it("uses defaultLimit from config when query.limit is omitted", async () => {
    let observedLimit = 0;
    const store: IVectorStore = {
      ...vectorStore,
      search: async (q) => {
        observedLimit = q.limit;
        return [];
      }
    };
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore: store,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 7,
      maxSnippetChars: 500
    });
    await strategy.search({ text: "x" });
    expect(observedLimit).toBe(7);
  });

  it("returns an empty result when no vectors match", async () => {
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 10,
      maxSnippetChars: 500
    });
    const result = await strategy.search({ text: "nomatch" });
    expect(result.hits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the strategy**

Create `packages/retrieval/src/SemanticRetrievalStrategy.ts`:

```ts
import type {
  Chunk,
  IEmbeddingProvider,
  IMetadataStore,
  IRanker,
  IRetrievalStrategy,
  IVectorStore,
  SearchHit,
  SearchQuery,
  SearchResult
} from "@sce/core";

export interface SemanticRetrievalStrategyDeps {
  embeddingProvider: IEmbeddingProvider;
  vectorStore: IVectorStore;
  metadataStore: IMetadataStore;
  ranker: IRanker;
  model: string;
  dimensions: number;
  defaultLimit: number;
  maxSnippetChars: number;
}

export class SemanticRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "semantic" as const;

  constructor(private readonly deps: SemanticRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    if (query.pathFilter !== undefined) {
      throw new Error("pathFilter is not supported in semantic mode");
    }
    if (query.language !== undefined) {
      throw new Error("language is not supported in semantic mode");
    }

    const start = performance.now();
    const [queryVector] = await this.deps.embeddingProvider.embed([query.text]);
    if (!queryVector) {
      return { hits: [], diagnostics: { strategy: "semantic", elapsedMs: Math.round(performance.now() - start), scannedChunks: 0 } };
    }

    const limit = query.limit ?? this.deps.defaultLimit;

    const vectorHits = await this.deps.vectorStore.search({
      vector: queryVector,
      limit,
      model: this.deps.model,
      dimensions: this.deps.dimensions,
      ...(query.repositoryIds ? { repositoryIds: query.repositoryIds } : {})
    });

    if (vectorHits.length === 0) {
      return { hits: [], diagnostics: { strategy: "semantic", elapsedMs: Math.round(performance.now() - start), scannedChunks: 0 } };
    }

    const chunkIds = vectorHits.map((h) => h.chunkId);
    const chunks = await this.deps.metadataStore.getChunks(chunkIds);
    const byId = new Map(chunks.map((c) => [c.id, c] as const));

    const baseHits: SearchHit[] = vectorHits
      .map((vh) => {
        const chunk = byId.get(vh.chunkId);
        if (!chunk) return null;
        const snippet = truncate(chunk.text, this.deps.maxSnippetChars);
        const hit: SearchHit = {
          chunkId: chunk.id,
          score: vh.score,
          strategy: "semantic",
          snippet,
          path: chunk.relativePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        };
        if (chunk.headingPath && chunk.headingPath.length > 0) hit.headingPath = chunk.headingPath;
        return hit;
      })
      .filter((h): h is SearchHit => h !== null);

    const ranked = this.deps.ranker.rank(baseHits, { ...query, mode: "semantic" });

    return {
      hits: ranked,
      diagnostics: {
        strategy: "semantic",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: vectorHits.length
      }
    };
  }
}

function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  return `${flat.slice(0, Math.max(0, maxChars - 3))}...`;
}
```

Modify `packages/retrieval/src/index.ts`:

```ts
export * from "./KeywordRetrievalStrategy.js";
export * from "./SemanticRetrievalStrategy.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/retrieval/src/__tests__/SemanticRetrievalStrategy.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/retrieval/src
git commit -m "feat(retrieval): add SemanticRetrievalStrategy"
```

---

## Task 8: Indexing embeds changed chunks and deletes vectors

**Files:**
- Modify: `packages/indexing/src/Indexer.ts`
- Modify: `packages/indexing/src/__tests__/Indexer.test.ts`
- Modify: `packages/indexing/package.json`

**Interfaces:**
- Consumes: `IEmbeddingProvider`, `IVectorStore`, `EmbeddingConfig` (model + dimensions) from `@sce/core`; `Chunk`.
- Produces: `IndexingServiceDeps` gains optional `embeddingProvider?: IEmbeddingProvider`, `vectorStore?: IVectorStore`, `embeddingConfig?: { model: string; dimensions: number }`. Rebuild boundary enforced: if `vectorStore.getModelDimensions(repositoryId)` differs from `embeddingConfig`, index throws a clear rebuild error.

- [ ] **Step 1: Write failing integration-style tests**

Append to `packages/indexing/src/__tests__/Indexer.test.ts`:

```ts
import { SqliteVectorStore } from "@sce/storage";
import type { IEmbeddingProvider, IVectorStore } from "@sce/core";

function fakeEmbedder(dimensions: number): IEmbeddingProvider {
  let counter = 0;
  return {
    embed: async (texts: string[]) => texts.map(() => Array.from({ length: dimensions }, () => ++counter / 1000))
  };
}

describe("IndexingService semantic embedding", () => {
  it("embeds changed chunks and stores vectors keyed by chunkId+repoId", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-sem-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const vectors = SqliteVectorStore.attach(storage.getDatabase());
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        embeddingProvider: fakeEmbedder(3),
        vectorStore: vectors,
        embeddingConfig: { model: "nomic-embed-text", dimensions: 3 }
      });

      const result = await service.indexRepository({ rootPath: dir, type: "vault" });

      const md = await vectors.getModelDimensions(result.repositoryId);
      expect(md).toEqual({ model: "nomic-embed-text", dimensions: 3 });
      const hits = await vectors.search({
        vector: Array.from({ length: 3 }, () => 0.5),
        limit: 10,
        model: "nomic-embed-text",
        dimensions: 3,
        repositoryIds: [result.repositoryId]
      });
      expect(hits.length).toBe(result.chunksIndexed);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("deletes vectors for files removed during prune", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-sem-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const vectors = SqliteVectorStore.attach(storage.getDatabase());
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        embeddingProvider: fakeEmbedder(2),
        vectorStore: vectors,
        embeddingConfig: { model: "m", dimensions: 2 }
      });

      const first = await service.indexRepository({ rootPath: dir, type: "vault" });
      await vectors.search({ vector: [0.5, 0.5], limit: 100, model: "m", dimensions: 2, repositoryIds: [first.repositoryId] });

      await unlink(join(dir, "Architecture.md"));
      await service.indexRepository({ rootPath: dir, type: "vault", repositoryId: first.repositoryId });

      const hits = await vectors.search({ vector: [0.5, 0.5], limit: 100, model: "m", dimensions: 2, repositoryIds: [first.repositoryId] });
      const remaining = hits.map((h) => h.chunkId);
      expect(remaining.some((id) => id.includes("Architecture"))).toBe(false);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("does not re-embed unchanged files on the second index run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-sem-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const vectors = SqliteVectorStore.attach(storage.getDatabase());
      const embedder = {
        embed: vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]))
      } as unknown as IEmbeddingProvider & { embed: ReturnType<typeof vi.fn> };
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        embeddingProvider: embedder,
        vectorStore: vectors,
        embeddingConfig: { model: "m", dimensions: 3 }
      });

      await service.indexRepository({ rootPath: dir, type: "vault" });
      const before = embedder.embed.mock.calls.length;
      await service.indexRepository({ rootPath: dir, type: "vault" });
      expect(embedder.embed.mock.calls.length).toBe(before); // no changed files
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("fails with a rebuild boundary when model/dimensions changed since last index", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-sem-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const vectors = SqliteVectorStore.attach(storage.getDatabase());
      const service1 = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        embeddingProvider: fakeEmbedder(3),
        vectorStore: vectors,
        embeddingConfig: { model: "old-model", dimensions: 3 }
      });
      const first = await service1.indexRepository({ rootPath: dir, type: "vault" });

      const service2 = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        embeddingProvider: fakeEmbedder(768),
        vectorStore: vectors,
        embeddingConfig: { model: "new-model", dimensions: 768 }
      });
      await expect(
        service2.indexRepository({ rootPath: dir, type: "vault", repositoryId: first.repositoryId })
      ).rejects.toThrow(/rebuild/i);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});
```

Add `import { SqliteStorage } from "@sce/storage";` at the top of the test file (and `vi` from vitest).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/indexing/src/__tests__/Indexer.test.ts`
Expected: FAIL — `IndexingServiceDeps` does not accept embedding fields; no embedding during indexing.

- [ ] **Step 3: Add @sce/storage as a dev/test dependency of indexing**

Modify `packages/indexing/package.json` to add under `dependencies`:

```json
    "@sce/storage": "0.0.0"
```

(Only because the integration test imports `SqliteStorage` directly. The production `Indexer.ts` must stay on `@sce/core` interfaces only — no `@sce/storage` import.)

- [ ] **Step 4: Extend IndexingService to embed and manage vectors**

Modify `packages/indexing/src/Indexer.ts`:

Add to imports:

```ts
import type { IEmbeddingProvider, IVectorStore } from "@sce/core";
```

Extend `IndexingServiceDeps`:

```ts
export interface IndexingServiceDeps {
  chunker: IChunker;
  metadataStore: IMetadataStore;
  keywordIndex: IKeywordIndex;
  embeddingProvider?: IEmbeddingProvider;
  vectorStore?: IVectorStore;
  embeddingConfig?: { model: string; dimensions: number };
  config?: Pick<SceConfig, "indexing">;
  logger?: Logger;
}
```

At the start of `indexRepository`, after `repositoryId` is computed and before file discovery, add the rebuild boundary check:

```ts
    const existingModel = this.deps.vectorStore
      ? await this.deps.vectorStore.getModelDimensions(repositoryId)
      : undefined;
    if (
      this.deps.vectorStore &&
      existingModel &&
      this.deps.embeddingConfig &&
      (existingModel.model !== this.deps.embeddingConfig.model ||
        existingModel.dimensions !== this.deps.embeddingConfig.dimensions)
    ) {
      throw new Error(
        `Embedding model/dimensions changed for repository ${repositoryId}: ` +
          `stored ${existingModel.model}/${existingModel.dimensions} vs config ` +
          `${this.deps.embeddingConfig.model}/${this.deps.embeddingConfig.dimensions}. ` +
          `Rebuild required: remove .sce/metadata.sqlite or run a fresh index.`
      );
    }
```

Inside the changed-file block — after `await this.deps.keywordIndex.indexChunks(chunks);` and before `chunksIndexed += chunks.length;` — add embedding when configured:

```ts
      if (this.deps.embeddingProvider && this.deps.vectorStore && this.deps.embeddingConfig) {
        const texts = chunks.map((c) => c.text);
        const vectors = await this.deps.embeddingProvider.embed(texts);
        if (vectors.length !== chunks.length) {
          throw new Error(
            `Embedding provider returned ${vectors.length} vectors for ${chunks.length} chunks (${relativePath})`
          );
        }
        for (let i = 0; i < chunks.length; i++) {
          await this.deps.vectorStore.upsert({
            chunkId: chunks[i]!.id,
            repositoryId,
            relativePath: chunks[i]!.relativePath,
            model: this.deps.embeddingConfig.model,
            dimensions: this.deps.embeddingConfig.dimensions,
            vector: vectors[i]!
          });
        }
        this.deps.logger?.debug("index.embedded", { relativePath, chunks: chunks.length });
      }
```

Before re-indexing a changed file, the existing code already calls `metadataStore.deleteChunksForFile` and `keywordIndex.removeChunksForFile`. Add vector cleanup alongside them: after `await this.deps.keywordIndex.removeChunksForFile(repositoryId, relativePath);` add:

```ts
      if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, relativePath);
```

In the prune loop (the `for (const record of storedFiles)` block), after `await this.deps.keywordIndex.removeChunksForFile(repositoryId, record.relativePath);` add:

```ts
      if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, record.relativePath);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/indexing/src/__tests__/Indexer.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/indexing/src packages/indexing/package.json
git commit -m "feat(indexing): embed changed chunks and prune vectors when semantic configured"
```

---

## Task 9: Core `SemanticContextEngine` routes semantic mode

**Files:**
- Modify: `packages/core/src/api/SemanticContextEngine.ts`
- Modify: `packages/core/src/api/SemanticContextEngine.test.ts`

**Interfaces:**
- Consumes: `IRetrievalStrategy` named `"semantic"` via a new optional `semanticStrategy` dep.
- Produces: `SemanticContextEngineDeps.semanticStrategy?: IRetrievalStrategy`. `search({ mode: "semantic" })` and `semanticSearch(query)` route to it when present, else throw `Semantic search is not configured`.

- [ ] **Step 1: Write failing tests**

Append to `packages/core/src/api/SemanticContextEngine.test.ts`:

```ts
describe("SemanticContextEngine semantic routing", () => {
  it("routes semantic mode to the semantic strategy when configured", async () => {
    const calls: SearchQuery[] = [];
    const semantic: IRetrievalStrategy = {
      name: "semantic",
      search: async (query) => {
        calls.push(query);
        return { hits: [{ chunkId: "c2", score: 0.5, strategy: "semantic", snippet: "semantic hit", path: "S.md", startLine: 1, endLine: 3 }], diagnostics: { strategy: "semantic" } };
      }
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: semantic
    });

    const result = await engine.search({ text: "vectors", mode: "semantic" });
    expect(result.hits[0]?.chunkId).toBe("c2");
    expect(calls[0]?.mode).toBe("semantic");
  });

  it("semanticSearch() delegates to the semantic strategy", async () => {
    const semantic: IRetrievalStrategy = {
      name: "semantic",
      search: async () => ({ hits: [], diagnostics: { strategy: "semantic" } })
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: semantic
    });
    const result = await engine.semanticSearch({ text: "vectors" });
    expect(result.diagnostics?.strategy).toBe("semantic");
  });

  it("throws a clear error when semantic is requested but not configured", async () => {
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) }
    });
    await expect(engine.search({ text: "vectors", mode: "semantic" })).rejects.toThrow(/Semantic search is not configured/);
    await expect(engine.semanticSearch({ text: "vectors" })).rejects.toThrow(/Semantic search is not configured/);
  });

  it("keeps keyword as the default when semantic is also configured", async () => {
    let keywordCalls = 0;
    let semanticCalls = 0;
    const engine = new SemanticContextEngine({
      keywordStrategy: {
        name: "keyword",
        search: async (q) => {
          keywordCalls++;
          return { hits: [{ chunkId: "k1", score: 1, strategy: "keyword", snippet: "", path: "K.md", startLine: 1, endLine: 1 }], diagnostics: { strategy: "keyword" } };
        }
      },
      semanticStrategy: {
        name: "semantic",
        search: async () => {
          semanticCalls++;
          return { hits: [], diagnostics: { strategy: "semantic" } };
        }
      }
    });
    await engine.search({ text: "x" });
    expect(keywordCalls).toBe(1);
    expect(semanticCalls).toBe(0);
  });
});
```

Add `import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";` at the top (already imported) and ensure `SearchQuery` import covers `mode`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: FAIL — `semanticStrategy` not a dep; `semanticSearch` throws "not implemented in v1".

- [ ] **Step 3: Update the engine**

Modify `packages/core/src/api/SemanticContextEngine.ts`:

Add to `SemanticContextEngineDeps`:

```ts
  semanticStrategy?: IRetrievalStrategy;
```

Replace the `search` method body to route semantic:

```ts
  async search(query: SearchQuery): Promise<SearchResult> {
    const mode = query.mode ?? "keyword";
    if (mode === "keyword") return this.keywordSearch(query);
    if (mode === "semantic") return this.semanticSearch(query);
    return this.unsupported(mode, query);
  }

  async keywordSearch(query: SearchQuery): Promise<SearchResult> {
    const result = await this.deps.keywordStrategy.search({ ...query, mode: "keyword" });
    this.deps.logger?.debug("search.done", {
      text: query.text,
      hits: result.hits.length,
      elapsedMs: result.diagnostics?.elapsedMs,
      repositoryIds: query.repositoryIds,
      pathFilter: query.pathFilter,
      language: query.language
    });
    return result;
  }

  async semanticSearch(query: SearchQuery): Promise<SearchResult> {
    if (!this.deps.semanticStrategy) {
      throw new Error("Semantic search is not configured (sce.config.json missing 'embedding' block)");
    }
    return this.deps.semanticStrategy.search({ ...query, mode: "semantic" });
  }
```

Remove the old `unsupported` private method's `semantic` case by deleting the line (`if mode !== keyword`) — i.e. replace the prior `search` method (which threw for any non-keyword mode) with the new one above. Keep `astSearch`/`hybridSearch` calling `this.unsupported(...)` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: PASS. Note the existing v1 test "rejects unsupported explicit modes until implemented" asserts that `mode: "semantic"` throws *"Search mode semantic is not implemented in v1"*. That assertion is now obsolete — update it to assert the *not-configured* error instead:

```ts
  it("throws a clear error when semantic is requested but not configured", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    await expect(engine.search({ text: "architecture", mode: "semantic" })).rejects.toThrow(
      /Semantic search is not configured/
    );
  });
```

(Replace the old "rejects unsupported explicit modes until implemented" test with the above to avoid a duplicate. Keep `ast`/`hybrid` mode rejection as a separate assertion:)

```ts
  it("rejects ast and hybrid modes as unimplemented", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    await expect(engine.search({ text: "x", mode: "ast" })).rejects.toThrow(/Search mode ast is not implemented in v1/);
    await expect(engine.search({ text: "x", mode: "hybrid" })).rejects.toThrow(/Search mode hybrid is not implemented in v1/);
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/api/SemanticContextEngine.ts packages/core/src/api/SemanticContextEngine.test.ts
git commit -m "feat(core): route semantic search to optional semantic strategy"
```

---

## Task 10: Runtime wires semantic when `embedding` configured

**Files:**
- Modify: `packages/runtime/src/createEngine.ts`
- Modify: `packages/runtime/src/__tests__/createEngine.test.ts`
- Modify: `packages/runtime/package.json`

**Interfaces:**
- Consumes: `config.embedding`, `OpenAICompatibleEmbeddingProvider.createEmbeddingProvider`, `SqliteVectorStore.attach`, `SemanticRetrievalStrategy`, `SimpleRanker`, `SqliteStorage.getDatabase()`.
- Produces: when `config.embedding` present, `createEngine` builds the provider, vector store, and semantic strategy and injects `semanticStrategy` into the engine and `embeddingProvider`/`vectorStore`/`embeddingConfig` into the `IndexingService`. Keyword-only path unchanged when absent.

- [ ] **Step 1: Write failing tests**

Append to `packages/runtime/src/__tests__/createEngine.test.ts`:

```ts
import { createEngine } from "../createEngine.js";

describe("createEngine semantic wiring", () => {
  it("builds a keyword-only engine when embedding is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-sem-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      // keyword search still works
      const result = await created.engine.search({ text: "SQLite", limit: 3 });
      expect(result.hits.length).toBeGreaterThan(0);
      // semantic is not configured
      await expect(created.engine.semanticSearch({ text: "SQLite" })).rejects.toThrow(/Semantic search is not configured/);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("wires semantic strategy when embedding block is present (using a stubbed provider via env)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-sem-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          embedding: {
            provider: "openai-compatible",
            baseUrl: "http://localhost:11434/v1",
            model: "nomic-embed-text",
            dimensions: 4
          }
        })
      );
      const created = await createEngine(dir);
      close = created.close;
      // Asking for semantic routes to the strategy; with no real server, search call
      // will embed by hitting the server. We only assert routing wires (engine accepts
      // semantic mode without the "not configured" error) by catching the fetch failure.
      await expect(created.engine.semanticSearch({ text: "vectors" })).rejects.toThrow(/Embedding provider|fetch|HTTP/);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: FAIL — `createEngine` does not build a semantic strategy; `semanticSearch` throws "not implemented in v1".

- [ ] **Step 3: Add @sce/embedding dependency to runtime**

Modify `packages/runtime/package.json` `dependencies` to include:

```json
    "@sce/embedding": "0.0.0"
```

- [ ] **Step 4: Wire semantic in createEngine**

Modify `packages/runtime/src/createEngine.ts`. Add imports:

```ts
import { createEmbeddingProvider } from "@sce/embedding";
import { SqliteVectorStore } from "@sce/storage";
import { SemanticRetrievalStrategy } from "@sce/retrieval";
```

After building `keywordStrategy`/`indexingService`, add:

```ts
  const embeddingConfig = config.embedding;
  const vectorStore = embeddingConfig ? SqliteVectorStore.attach(storage.getDatabase()) : undefined;
  const embeddingProvider = embeddingConfig ? createEmbeddingProvider(embeddingConfig) : undefined;
  const semanticStrategy =
    embeddingConfig && vectorStore
      ? new SemanticRetrievalStrategy({
          embeddingProvider: embeddingProvider!,
          vectorStore,
          metadataStore: storage,
          ranker,
          model: embeddingConfig.model,
          dimensions: embeddingConfig.dimensions,
          defaultLimit: config.search.defaultLimit,
          maxSnippetChars: config.search.maxSnippetChars
        })
      : undefined;
```

Pass `embeddingProvider`, `vectorStore`, and `embeddingConfig` into the `IndexingService` constructor:

```ts
  const indexingService = new IndexingService({
    chunker: new MarkdownChunker(),
    metadataStore: storage,
    keywordIndex: storage,
    ...(embeddingProvider ? { embeddingProvider } : {}),
    ...(vectorStore ? { vectorStore } : {}),
    ...(embeddingConfig ? { embeddingConfig } : {}),
    config,
    logger: logger.child({ component: "indexing" })
  });
```

Pass `semanticStrategy` into the engine:

```ts
  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      ...(semanticStrategy ? { semanticStrategy } : {}),
      indexingService,
      metadataStore: storage,
      logger: logger.child({ component: "engine" })
    }),
    config,
    rootPath: resolvedRoot,
    logger,
    close: () => storage.close()
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: PASS. The keyword-only test still passes; the semantic test asserts a routing/embedding call happens (provoking a fetch error against the unreachable `localhost:11434`).

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src packages/runtime/package.json
git commit -m "feat(runtime): wire semantic search when embedding config is present"
```

---

## Task 11: CLI `--mode semantic`

**Files:**
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/__tests__/main.test.ts`

**Interfaces:**
- Consumes: `engine.search({ mode })`.
- Produces: `sce search <query> --mode keyword|semantic --path <path>`. Default `keyword`. When semantic is requested but not configured, surface the engine error message to stderr (the existing top-level `catch` already does).

- [ ] **Step 1: Write failing test**

Append to `packages/cli/src/__tests__/main.test.ts`:

```ts
it("surfaces a clear error for --mode semantic when embedding is not configured", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sce-cli-sem-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
    await run(["search", "vectors", "--path", dir, "--mode", "semantic"]);
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/Semantic search is not configured/));
  } finally {
    await rmWithRetry(dir);
  }
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npx vitest run packages/cli/src/__tests__/main.test.ts`
Expected: FAIL — commander rejects unknown `--mode` option (error for unknown flag) rather than the semantic-not-configured message. The catch may print a commander help error, not our message.

- [ ] **Step 3: Add the --mode option**

Modify `packages/cli/src/main.ts` `search` command definition: add after the `--language` option:

```ts
    .option("--mode <mode>", "search mode: keyword (default) or semantic")
    .option("--path-filter <glob>", "restrict hits by path (exact, prefix, or GLOB)")
    .option("--language <language>", "restrict hits by language")
    .option("-m, --mode <mode>", "search mode: keyword (default) or semantic")
```

Only one `--mode` option line is needed; use:

```ts
    .option("--mode <mode>", "search mode: keyword (default) or semantic", "keyword")
```

In the `search` action, change the `engine.search` call to pass `mode`:

```ts
        const mode = options.mode === "semantic" ? "semantic" : "keyword";
        const result = await engine.search({
          text: query,
          mode,
          limit,
          pathFilter: options.pathFilter,
          language: options.language
        });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/cli/src/__tests__/main.test.ts`
Expected: PASS. (Existing keyword tests pass `mode: "keyword"` by default.)

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/main.ts packages/cli/src/__tests__/main.test.ts
git commit -m "feat(cli): add --mode semantic to search command"
```

---

## Task 12: MCP `mode` field

**Files:**
- Modify: `packages/mcp/src/tools.ts`
- Modify: `packages/mcp/src/server.ts`
- Modify: `packages/mcp/src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `engine.search({ mode })`.
- Produces: `sceSearch` accepts `mode?: "keyword" | "semantic"` and forwards it.

- [ ] **Step 1: Write failing test**

Append to `packages/mcp/src/__tests__/tools.test.ts`:

```ts
it("surfaces semantic-not-configured when mode=semantic and embedding is absent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sce-mcp-sem-"));
  try {
    await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
    await expect(sceSearch({ path: dir, query: "vectors", mode: "semantic" })).rejects.toThrow(
      /Semantic search is not configured/
    );
  } finally {
    await rmWithRetry(dir);
  }
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npx vitest run packages/mcp/src/__tests__/tools.test.ts`
Expected: FAIL — `sceSearch` ignores `mode` and returns keyword results; no error.

- [ ] **Step 3: Forward mode in tools and add to schema**

Modify `packages/mcp/src/tools.ts` `sceSearch` input type to add `mode?: "keyword" | "semantic"` and forward it:

```ts
export async function sceSearch(input: {
  path: string;
  query: string;
  mode?: "keyword" | "semantic";
  limit?: number;
  includeText?: boolean;
  pathFilter?: string;
  language?: string;
  repositoryIds?: string[];
}) {
  const { engine, close, config } = await createEngine(input.path);
  try {
    const result = await engine.search({
      text: input.query,
      mode: input.mode ?? "keyword",
      limit: input.limit ?? config.search.defaultLimit,
      pathFilter: input.pathFilter,
      language: input.language,
      repositoryIds: input.repositoryIds
    });
    // ... existing hydration block unchanged
```

Modify `packages/mcp/src/server.ts` `sce_search` schema to add:

```ts
    mode: z.enum(["keyword", "semantic"]).optional(),
```

(alongside the existing `path`, `query`, `limit`, etc.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/mcp/src/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src
git commit -m "feat(mcp): accept mode field on sce_search"
```

---

## Task 13: Full end-to-end semantic index + search with a stubbed HTTP server

**Files:**
- Create: `packages/runtime/src/__tests__/semantic-e2e.test.ts`

**Interfaces:**
- Consumes: `createEngine`, a tiny local HTTP echo embedding server.
- Produces: a passing integration test proving index embeds and semantic search returns hydrated hits with `strategy: "semantic"`.

- [ ] **Step 1: Write failing test**

Create `packages/runtime/src/__tests__/semantic-e2e.test.ts`:

```ts
import { mkdtemp, cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { createEngine } from "../createEngine.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function startStubEmbeddingServer(dimensions: number): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      let parsed: { input?: string[] } = {};
      try { parsed = JSON.parse(body); } catch {}
      const n = parsed.input?.length ?? 1;
      const data = Array.from({ length: n }, () => ({ embedding: Array.from({ length: dimensions }, () => 0.01) }));
      res.end(JSON.stringify({ data }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { baseUrl: `http://127.0.0.1:${port}/v1`, close: () => new Promise((r) => server.close(() => r())) };
}

describe("sem search end-to-end", () => {
  it("indexes and searches semantically through runtime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sem-e2e-"));
    let close: (() => void) | undefined;
    const server = await startStubEmbeddingServer(8);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          embedding: {
            provider: "openai-compatible",
            baseUrl: server.baseUrl,
            model: "stub-embed",
            dimensions: 8
          }
        })
      );

      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });

      const result = await created.engine.semanticSearch({ text: "vector retrieval", limit: 10 });
      expect(result.diagnostics?.strategy).toBe("semantic");
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits.every((hit) => hit.strategy === "semantic")).toBe(true);
      for (const hit of result.hits) {
        expect(hit.path.length).toBeGreaterThan(0);
        expect(hit.chunkId.length).toBeGreaterThan(0);
      }
    } finally {
      close?.();
      await server.close();
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run packages/runtime/src/__tests__/semantic-e2e.test.ts`
Expected: PASS (Task 10 already wired everything). If it FAILS, the bug is in Tasks 8/10 wiring — fix those, not this test's expectations.

- [ ] **Step 3: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. All existing keyword/CLI/MCP tests unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/__tests__/semantic-e2e.test.ts
git commit -m "test(runtime): end-to-end semantic index and search"
```

---

## Task 14: README and HANDOFF documentation

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: final behavior of Tasks 1–13.
- Produces: documented config, CLI/MCP surface, and explicit non-goals/future work.

- [ ] **Step 1: Update README**

In `README.md`, after the "Search filters" section, add a "Semantic search (opt-in)" section:

```markdown
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
```

Update the "Explicit non-goals (v1)" list to clarify the new state: replace "Embeddings / vector DB" with "Binary vector layout / ANN index / hybrid / AST / cloud-only providers / UI / Pasttime coupling". Update the "Packages" table to note `@sce/embedding` implements `OpenAICompatibleEmbeddingProvider`.

Add a "Future work" note inside the semantic section:

```markdown
The future goal is a separate `.sce/semantic/` layout (`embeddings.bin`, `vector.index`) behind the same `IVectorStore` interface, plus hybrid, AST, ANN indexing, and cloud-only providers as later slices.
```

- [ ] **Step 2: Update HANDOFF.md**

Append to the "Recently shipped" header a new `### Shipped (semantic slice, 2026-07-13)` block listing:
- Opt-in `embedding` config block in `sce.config.json`
- `@sce/embedding` `OpenAICompatibleEmbeddingProvider`
- `@sce/storage` `SqliteVectorStore` (SQLite vectors behind `IVectorStore`)
- `@sce/retrieval` `SemanticRetrievalStrategy`
- Indexing embeds changed chunks and prunes vectors; rebuild boundary on model/dimensions change
- `@sce/runtime` wires semantic when configured
- CLI `--mode semantic`, MCP `mode` field
- `iv` search filters `pathFilter`/`language` rejected with semantic

Update "Canonical docs" to add the semantic spec and this plan. Update "Known follow-ups" to remove "Semantic" and keep AST/hybrid/binary layout/cloud providers/UI as still-open follow-ups.

- [ ] **Step 3: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: document semantic search slice"
```

---

## Self-Review Notes (for the reviewer)

Spec coverage check:
- Opt-in via `embedding` config → Task 1. ✓
- Provider: OpenAI-compatible HTTP → Task 3. ✓
- Vector store NOW: SQLite behind IVectorStore → Tasks 2, 4, 5, 6. ✓
- Vector store LATER (document, not implement) → Task 14. ✓
- Embed during index/update → Task 8. ✓
- Semantic mode only; keyword default → Tasks 9, 10. ✓
- `repositoryIds` supported by semantic → Tasks 4, 7. ✓
- `pathFilter`/`language` keyword-only and error with semantic → Task 7. ✓
- Model/dimensions change = rebuild boundary → Task 8. ✓
- Index fails hard if provider unreachable → Tasks 3 (throws) + 8 (await). ✓
- Reuse SimpleRanker → Tasks 7, 10. ✓
- CLI `--mode semantic` → Task 11. ✓
- MCP `mode` field → Task 12. ✓
- Pasttime untouched → no task references it; Global Constraint forbids it. ✓
- Docs/HANDOFF → Task 14. ✓

Non-goals restated in plan: hybrid, AST, binary layout, ANN, cloud providers, UI, Pasttime. ✓

Type/name consistency verified across tasks:
- `VectorUpsert.relativePath` added in Task 4 step 5 and consumed in Task 8. ✓
- `IVectorStore` method names (`upsert`, `search`, `deleteByChunk`, `deleteByRepository`, `deleteByFile`, `getModelDimensions`) match across Tasks 4, 5, 7, 8, 10. ✓
- `SemanticRetrievalStrategyDeps` fields match Task 7 consumer in Task 10. ✓
- `IndexingServiceDeps` optional embedding fields match Task 8 consumer in Task 10. ✓
- `SemanticContextEngineDeps.semanticStrategy` matches Task 9 consumer in Task 10. ✓
```