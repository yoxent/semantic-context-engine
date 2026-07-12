import { mkdtemp, cp, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { MarkdownChunker } from "@sce/parsing";
import { SqliteStorage } from "@sce/storage";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { IndexingService } from "../Indexer.js";

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
});
