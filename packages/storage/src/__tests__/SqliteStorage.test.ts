import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
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
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const chunk = makeChunk();

      await storage.saveChunks([chunk]);
      await storage.indexChunks([chunk]);

      const hits = await storage.search({ text: "SQLite metadata", limit: 5 });

      expect(hits).toHaveLength(1);
      expect(hits[0]?.chunkId).toBe("chunk-1");
      expect(hits[0]?.path).toBe("Architecture.md");
      expect(hits[0]?.snippet).toContain("SQLite");
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("deleteRepository removes chunk_links for repository chunks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const chunk = makeChunk({ wikiLinks: ["Storage", "Schema"] });

      await storage.saveRepository({
        id: "repo",
        rootPath: dir,
        type: "vault",
        indexedAt: new Date("2026-07-12T00:00:00.000Z")
      });
      await storage.saveChunks([chunk]);

      const db = openRawDb(dir);
      try {
        expect(getChunkLinks(db, chunk.id)).toEqual(["Schema", "Storage"]);
      } finally {
        db.close();
      }

      await storage.deleteRepository("repo");

      const dbAfter = openRawDb(dir);
      try {
        expect(countChunkLinks(dbAfter)).toBe(0);
      } finally {
        dbAfter.close();
      }
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("re-saving chunk with different wikiLinks replaces links", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const chunk = makeChunk({ wikiLinks: ["Alpha", "Beta"] });

      await storage.saveChunks([chunk]);

      const db = openRawDb(dir);
      try {
        expect(getChunkLinks(db, chunk.id)).toEqual(["Alpha", "Beta"]);
      } finally {
        db.close();
      }

      await storage.saveChunks([makeChunk({ wikiLinks: ["Gamma"] })]);

      const dbAfter = openRawDb(dir);
      try {
        expect(getChunkLinks(dbAfter, chunk.id)).toEqual(["Gamma"]);
      } finally {
        dbAfter.close();
      }
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("returns empty results for malformed FTS queries without throwing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const chunk = makeChunk();

      await storage.saveChunks([chunk]);
      await storage.indexChunks([chunk]);

      await expect(storage.search({ text: 'foo"bar', limit: 5 })).resolves.toEqual([]);
      await expect(storage.search({ text: '""" OR NOT', limit: 5 })).resolves.toEqual([]);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("double indexChunks does not duplicate search hits", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const chunk = makeChunk();

      await storage.saveChunks([chunk]);
      await storage.indexChunks([chunk]);
      await storage.indexChunks([chunk]);

      const hits = await storage.search({ text: "SQLite metadata", limit: 5 });

      expect(hits).toHaveLength(1);
      expect(hits[0]?.chunkId).toBe("chunk-1");
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("reports index statistics", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const chunk = makeChunk({ wikiLinks: ["Storage"] });
      await storage.saveRepository({
        id: "repo",
        rootPath: dir,
        type: "vault",
        indexedAt: new Date("2026-07-12T00:00:00.000Z")
      });
      await storage.saveFile({
        repositoryId: "repo",
        relativePath: chunk.relativePath,
        language: "markdown",
        fileHash: "hash",
        indexedAt: new Date("2026-07-12T00:00:00.000Z")
      });
      await storage.saveChunks([chunk]);

      const stats = await storage.getStatistics();
      expect(stats).toMatchObject({
        repositoryCount: 1,
        fileCount: 1,
        chunkCount: 1,
        linkCount: 1,
        lastIndexedAt: "2026-07-12T00:00:00.000Z"
      });
      expect(stats.repositories[0]).toMatchObject({
        id: "repo",
        fileCount: 1,
        chunkCount: 1
      });
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("honors repositoryIds, pathFilter, and language filters", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-storage-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const keep = makeChunk({
        id: "keep",
        repositoryId: "repo-a",
        relativePath: "notes/Architecture.md",
        language: "markdown",
        text: "SQLite stores metadata for vault notes."
      });
      const otherRepo = makeChunk({
        id: "other-repo",
        repositoryId: "repo-b",
        relativePath: "notes/Architecture.md",
        language: "markdown",
        text: "SQLite stores metadata for vault notes."
      });
      const otherPath = makeChunk({
        id: "other-path",
        repositoryId: "repo-a",
        relativePath: "README.md",
        language: "markdown",
        text: "SQLite stores metadata for vault notes."
      });
      const otherLang = makeChunk({
        id: "other-lang",
        repositoryId: "repo-a",
        relativePath: "notes/code.ts",
        language: "typescript",
        text: "SQLite stores metadata for vault notes."
      });

      for (const chunk of [keep, otherRepo, otherPath, otherLang]) {
        await storage.saveChunks([chunk]);
        await storage.indexChunks([chunk]);
      }

      const byRepo = await storage.search({ text: "SQLite metadata", repositoryIds: ["repo-a"], limit: 10 });
      expect(byRepo.map((h) => h.chunkId).sort()).toEqual(["keep", "other-lang", "other-path"]);

      const byPathPrefix = await storage.search({
        text: "SQLite metadata",
        repositoryIds: ["repo-a"],
        pathFilter: "notes",
        limit: 10
      });
      expect(byPathPrefix.map((h) => h.chunkId).sort()).toEqual(["keep", "other-lang"]);

      const byGlob = await storage.search({
        text: "SQLite metadata",
        pathFilter: "notes/*.md",
        limit: 10
      });
      expect(byGlob.map((h) => h.chunkId).sort()).toEqual(["keep", "other-repo"]);

      const byLanguage = await storage.search({
        text: "SQLite metadata",
        repositoryIds: ["repo-a"],
        language: "markdown",
        limit: 10
      });
      expect(byLanguage.map((h) => h.chunkId).sort()).toEqual(["keep", "other-path"]);
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});
