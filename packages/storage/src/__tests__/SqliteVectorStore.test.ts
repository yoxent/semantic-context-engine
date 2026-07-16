import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
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
        relativePath: "Architecture.md",
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
        vectors.upsert({ chunkId: "c2", repositoryId: "repo-a", relativePath: "f.md", model: "m", dimensions: 3, vector: [1, 2] })
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
      await vectors.upsert({ chunkId: "c1", repositoryId: "repo-a", relativePath: "f.md", model: "m", dimensions: 2, vector: [1, 2] });
      await vectors.upsert({ chunkId: "c1", repositoryId: "repo-a", relativePath: "f.md", model: "m", dimensions: 2, vector: [3, 4] });
      const hits = await vectors.search({ vector: [3, 4], limit: 5, model: "m", dimensions: 2, repositoryIds: ["repo-a"] });
      expect(hits).toHaveLength(1);
      expect(hits[0]?.chunkId).toBe("c1");
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });
});

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

  it("skips malformed stored vector payloads instead of failing the whole search", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-vec-"));
    try {
      const { storage, vectors } = await openStores(dir);
      await vectors.upsert({ chunkId: "bad", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [1, 0], relativePath: "bad.md" });
      await vectors.upsert({ chunkId: "good", repositoryId: "repo-a", model: "m", dimensions: 2, vector: [0, 1], relativePath: "good.md" });
      storage.getDatabase().prepare("UPDATE vectors SET vector = ? WHERE chunk_id = ?").run("{not-json", "bad");

      const hits = await vectors.search({ vector: [0, 1], limit: 10, model: "m", dimensions: 2, repositoryIds: ["repo-a"] });
      expect(hits.map((h) => h.chunkId)).toEqual(["good"]);
      storage.close();
    } finally {
      await rmWithRetry(dir);
    }
  });
});
