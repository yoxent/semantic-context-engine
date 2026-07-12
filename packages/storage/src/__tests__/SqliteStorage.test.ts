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
