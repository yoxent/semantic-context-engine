import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { SqliteStorage } from "../SqliteStorage.js";
import type { Chunk } from "@sce/core";

function openRawDb(rootPath: string): Database.Database {
  return new Database(join(rootPath, ".sce", "metadata.sqlite"));
}

function getChunkLinks(db: Database.Database, sourceChunkId: string): string[] {
  return (db.prepare("SELECT target FROM chunk_links WHERE source_chunk_id = ? ORDER BY target").all(sourceChunkId) as { target: string }[])
    .map((row) => row.target);
}

function countChunkLinks(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS count FROM chunk_links").get() as { count: number }).count;
}

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
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
    wikiLinks: ["Storage"],
    ...overrides
  };
}

describe("SqliteStorage", () => {
  it("persists chunks and searches through FTS", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    try {
      const storage = await SqliteStorage.open(dir);
      const chunk = makeChunk();

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

  it("deleteRepository removes chunk_links for repository chunks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    try {
      const storage = await SqliteStorage.open(dir);
      const chunk = makeChunk({ wikiLinks: ["Storage", "Schema"] });

      await storage.saveRepository({
        id: "repo",
        rootPath: dir,
        type: "vault",
        indexedAt: new Date("2026-07-12T00:00:00.000Z")
      });
      await storage.saveChunks([chunk]);

      const db = openRawDb(dir);
      expect(getChunkLinks(db, chunk.id)).toEqual(["Schema", "Storage"]);
      db.close();

      await storage.deleteRepository("repo");

      const dbAfter = openRawDb(dir);
      expect(countChunkLinks(dbAfter)).toBe(0);
      dbAfter.close();
      storage.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("re-saving chunk with different wikiLinks replaces links", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    try {
      const storage = await SqliteStorage.open(dir);
      const chunk = makeChunk({ wikiLinks: ["Alpha", "Beta"] });

      await storage.saveChunks([chunk]);

      const db = openRawDb(dir);
      expect(getChunkLinks(db, chunk.id)).toEqual(["Alpha", "Beta"]);
      db.close();

      await storage.saveChunks([makeChunk({ wikiLinks: ["Gamma"] })]);

      const dbAfter = openRawDb(dir);
      expect(getChunkLinks(dbAfter, chunk.id)).toEqual(["Gamma"]);
      dbAfter.close();
      storage.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns empty results for malformed FTS queries without throwing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    try {
      const storage = await SqliteStorage.open(dir);
      const chunk = makeChunk();

      await storage.saveChunks([chunk]);
      await storage.indexChunks([chunk]);

      await expect(storage.search({ text: 'foo"bar', limit: 5 })).resolves.toEqual([]);
      await expect(storage.search({ text: '""" OR NOT', limit: 5 })).resolves.toEqual([]);
      storage.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("double indexChunks does not duplicate search hits", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    try {
      const storage = await SqliteStorage.open(dir);
      const chunk = makeChunk();

      await storage.saveChunks([chunk]);
      await storage.indexChunks([chunk]);
      await storage.indexChunks([chunk]);

      const hits = await storage.search({ text: "SQLite metadata", limit: 5 });

      expect(hits).toHaveLength(1);
      expect(hits[0]?.chunkId).toBe("chunk-1");
      storage.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
