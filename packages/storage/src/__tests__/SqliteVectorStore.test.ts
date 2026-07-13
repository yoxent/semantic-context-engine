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