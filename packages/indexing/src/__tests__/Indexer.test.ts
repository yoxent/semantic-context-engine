import { createHash } from "node:crypto";
import { mkdtemp, cp, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { detectLanguage } from "@sce/core";
import type { ISymbolIndex } from "@sce/core";
import { LanguageChunkerRegistry, MarkdownChunker, TreeSitterCodeChunker } from "@sce/parsing";
import { SqliteStorage, SqliteVectorStore } from "@sce/storage";
import type { IEmbeddingProvider, IVectorStore } from "@sce/core";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { IndexingService } from "../Indexer.js";

function fakeEmbedder(dimensions: number): IEmbeddingProvider {
  let counter = 0;
  return {
    embed: async (texts: string[]) => texts.map(() => Array.from({ length: dimensions }, () => ++counter / 1000))
  };
}

describe("IndexingService", () => {
  it("indexes markdown vault chunks and refreshes changed files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
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
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("re-indexes changed files with updated searchable content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage
      });

      const first = await service.indexRepository({ rootPath: dir, type: "vault" });
      const unchanged = await service.indexRepository({
        rootPath: dir,
        type: "vault",
        repositoryId: first.repositoryId
      });
      expect(unchanged.chunksIndexed).toBe(0);

      await writeFile(
        join(dir, "Architecture.md"),
        "# Architecture\n\nUpdated vector retrieval design.\n",
        "utf8"
      );

      const refresh = await service.indexRepository({
        rootPath: dir,
        type: "vault",
        repositoryId: first.repositoryId
      });
      expect(refresh.chunksIndexed).toBeGreaterThan(0);

      const updatedHits = await storage.search({ text: "vector retrieval", limit: 5 });
      expect(updatedHits.some((hit) => hit.path === "Architecture.md")).toBe(true);

      const staleHits = await storage.search({ text: "SQLite FTS5", limit: 5 });
      expect(staleHits.some((hit) => hit.path === "Architecture.md")).toBe(false);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("prunes deleted files on re-index", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage
      });

      const first = await service.indexRepository({ rootPath: dir, type: "vault" });
      let hits = await storage.search({ text: "SQLite FTS5", limit: 5 });
      expect(hits.some((hit) => hit.path === "Architecture.md")).toBe(true);

      await unlink(join(dir, "Architecture.md"));
      await service.indexRepository({
        rootPath: dir,
        type: "vault",
        repositoryId: first.repositoryId
      });

      hits = await storage.search({ text: "SQLite FTS5", limit: 5 });
      expect(hits.some((hit) => hit.path === "Architecture.md")).toBe(false);

      const file = await storage.getFile(first.repositoryId, "Architecture.md");
      expect(file).toBeUndefined();
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("honors indexing include patterns from config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-"));
    let storage: SqliteStorage | undefined;
    try {
      await cp("fixtures/sample-vault", dir, { recursive: true });
      storage = await SqliteStorage.open(dir);
      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        config: {
          indexing: {
            include: ["Architecture.md"],
            ignore: [".git/**", ".sce/**"]
          }
        }
      });

      const result = await service.indexRepository({ rootPath: dir, type: "vault" });
      expect(result.filesIndexed).toBe(1);

      const architectureHits = await storage.search({ text: "SQLite FTS5", limit: 5 });
      expect(architectureHits[0]?.path).toBe("Architecture.md");

      const agentHits = await storage.search({ text: "concise snippets", limit: 5 });
      expect(agentHits).toHaveLength(0);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});

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

describe("IndexingService language handling", () => {
  it("skips text-language files before reading them and cleans up any pre-existing record", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-lang-"));
    let storage: SqliteStorage | undefined;
    try {
      await writeFile(join(dir, "data.json"), JSON.stringify({ hello: "world" }), "utf8");
      storage = await SqliteStorage.open(dir);
      const repositoryId = createHash("sha256").update(resolve(dir)).digest("hex").slice(0, 16);

      // Sanity: detectLanguage classifies .json as text (the skip condition).
      expect(detectLanguage("data.json")).toBe("text");

      // Pre-seed a file record + chunk for data.json as if a prior, broader index had recorded it.
      const fileHash = "preexisting-hash";
      const chunkId = createHash("sha256")
        .update(`${repositoryId}:data.json:1:1:text:${fileHash}`)
        .digest("hex");
      await storage.saveFile({
        repositoryId,
        relativePath: "data.json",
        language: "text",
        fileHash,
        indexedAt: new Date()
      });
      await storage.saveChunks([
        {
          id: chunkId,
          repositoryId,
          relativePath: "data.json",
          language: "text",
          startLine: 1,
          endLine: 1,
          text: '{"hello":"world"}',
          fileHash,
          timestamp: new Date(),
          headingPath: []
        }
      ]);
      expect(await storage.getFile(repositoryId, "data.json")).toBeDefined();
      expect(await storage.getChunk(chunkId)).toBeDefined();

      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        config: {
          indexing: {
            include: ["**/*.json"],
            ignore: [".git/**", ".sce/**"]
          }
        }
      });

      const result = await service.indexRepository({ rootPath: dir, type: "vault" });
      // The file was discovered but skipped — no chunks produced.
      expect(result.filesIndexed).toBe(1);
      expect(result.chunksIndexed).toBe(0);

      // Pre-existing record + chunk are cleaned up by the skip guard.
      expect(await storage.getFile(repositoryId, "data.json")).toBeUndefined();
      expect(await storage.getChunk(chunkId)).toBeUndefined();
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("chunks .ts files with symbol-aware TreeSitterCodeChunker via the registry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-lang-"));
    let storage: SqliteStorage | undefined;
    try {
      await writeFile(
        join(dir, "greet.ts"),
        'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n',
        "utf8"
      );
      storage = await SqliteStorage.open(dir);

      const registry = new LanguageChunkerRegistry({
        chunkers: {
          markdown: new MarkdownChunker(),
          typescript: await TreeSitterCodeChunker.create("typescript"),
          javascript: await TreeSitterCodeChunker.create("javascript")
        }
      });
      const chunkSpy = vi.spyOn(registry, "chunk");

      const service = new IndexingService({
        chunker: registry,
        metadataStore: storage,
        keywordIndex: storage,
        config: {
          indexing: {
            include: ["**/*.ts"],
            ignore: [".git/**", ".sce/**"]
          }
        }
      });

      const result = await service.indexRepository({ rootPath: dir, type: "vault" });
      expect(result.filesIndexed).toBe(1);
      expect(result.chunksIndexed).toBeGreaterThan(0);

      const chunks = chunkSpy.mock.results.map((r) => r.value).flat();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((c: { symbolKind?: string }) => c.symbolKind !== undefined)).toBe(true);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});

describe("IndexingService symbol index integration", () => {
  it("writes symbols after indexChunks and prunes on file delete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      await writeFile(
        join(dir, "greet.ts"),
        "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n",
        "utf8"
      );
      storage = await SqliteStorage.open(dir);

      const symbolIndexCalls: string[] = [];
      const symbolIndex: ISymbolIndex = {
        indexSymbols: async (chunks) => {
          symbolIndexCalls.push(`indexSymbols:${chunks.length}`);
        },
        removeSymbolsForFile: async (_repoId, relPath) => {
          symbolIndexCalls.push(`removeSymbolsForFile:${relPath}`);
        },
        deleteByRepository: async () => undefined,
        searchSymbols: async () => []
      };

      const registry = new LanguageChunkerRegistry({
        chunkers: {
          markdown: new MarkdownChunker(),
          typescript: await TreeSitterCodeChunker.create("typescript"),
          javascript: await TreeSitterCodeChunker.create("javascript")
        }
      });

      const service = new IndexingService({
        chunker: registry,
        metadataStore: storage,
        keywordIndex: storage,
        symbolIndex,
        config: { indexing: { include: ["**/*.ts"], ignore: [".git/**", ".sce/**"] } }
      });

      // First index: should call removeSymbolsForFile then indexSymbols
      await service.indexRepository({ rootPath: dir, type: "vault" });
      expect(symbolIndexCalls.some((c) => c.startsWith("removeSymbolsForFile:greet.ts"))).toBe(true);
      expect(symbolIndexCalls.some((c) => c.startsWith("indexSymbols:") && !c.endsWith("indexSymbols:0"))).toBe(true);

      // Prune: delete file, re-index — should call removeSymbolsForFile for the pruned file
      symbolIndexCalls.length = 0;
      await unlink(join(dir, "greet.ts"));
      await service.indexRepository({ rootPath: dir, type: "vault" });
      expect(symbolIndexCalls.some((c) => c === "removeSymbolsForFile:greet.ts")).toBe(true);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("does NOT call symbolIndex for text-skip files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-index-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      await writeFile(join(dir, "data.json"), JSON.stringify({ hello: "world" }), "utf8");
      storage = await SqliteStorage.open(dir);

      const symbolIndexCalls: string[] = [];
      const symbolIndex: ISymbolIndex = {
        indexSymbols: async (chunks) => { symbolIndexCalls.push(`indexSymbols:${chunks.length}`); },
        removeSymbolsForFile: async (_repoId, relPath) => { symbolIndexCalls.push(`removeSymbolsForFile:${relPath}`); },
        deleteByRepository: async () => undefined,
        searchSymbols: async () => []
      };

      const service = new IndexingService({
        chunker: new MarkdownChunker(),
        metadataStore: storage,
        keywordIndex: storage,
        symbolIndex,
        config: { indexing: { include: ["**/*.json"], ignore: [".git/**", ".sce/**"] } }
      });

      await service.indexRepository({ rootPath: dir, type: "vault" });
      // text-skip should NOT touch symbols at all
      expect(symbolIndexCalls).toHaveLength(0);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});
