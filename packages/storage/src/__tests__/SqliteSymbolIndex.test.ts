import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { SqliteStorage } from "../SqliteStorage.js";
import { SqliteSymbolIndex } from "../SqliteSymbolIndex.js";
import type { Chunk } from "@sce/core";

function makeChunk(overrides: Partial<Chunk> & { id: string; repositoryId: string; relativePath: string }): Chunk {
  return {
    language: "typescript",
    startLine: 1,
    endLine: 3,
    text: "function foo() {}",
    fileHash: "h",
    timestamp: new Date("2026-07-13T00:00:00.000Z"),
    headingPath: ["foo"],
    ...overrides
  } as Chunk;
}

describe("SqliteSymbolIndex writes", () => {
  it("indexSymbols inserts rows only for chunks with a symbolKind", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const index = SqliteSymbolIndex.attach(storage.getDatabase());

      const chunks: Chunk[] = [
        makeChunk({ id: "c1", repositoryId: "repo", relativePath: "a.ts", symbolKind: "class", headingPath: ["Widget"] }),
        makeChunk({ id: "c2", repositoryId: "repo", relativePath: "b.ts", headingPath: ["readme"] }), // no symbolKind
        makeChunk({ id: "c3", repositoryId: "repo", relativePath: "a.ts", symbolKind: "function", headingPath: ["Widget", "render"] })
      ];
      await index.indexSymbols(chunks);

      const rows = storage.getDatabase().prepare("SELECT * FROM symbols").all() as any[];
      expect(rows).toHaveLength(2);
      expect(rows[0].chunk_id).toBe("c1");
      expect(rows[0].symbol_kind).toBe("class");
      expect(rows[0].name).toBe("Widget");
      expect(rows[0].qualified_name).toBe("Widget");
      expect(rows[1].chunk_id).toBe("c3");
      expect(rows[1].name).toBe("render");
      expect(rows[1].qualified_name).toBe("Widget/render");
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("indexSymbols is a replace for the file when combined with removeSymbolsForFile", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const index = SqliteSymbolIndex.attach(storage.getDatabase());

      await index.indexSymbols([
        makeChunk({ id: "c1", repositoryId: "repo", relativePath: "a.ts", symbolKind: "class", headingPath: ["Widget"] }),
        makeChunk({ id: "c2", repositoryId: "repo", relativePath: "a.ts", symbolKind: "function", headingPath: ["helper"] })
      ]);
      expect(storage.getDatabase().prepare("SELECT COUNT(*) as cnt FROM symbols").get() as any).toEqual({ cnt: 2 });

      // Simulate indexer pattern: remove then re-index
      await index.removeSymbolsForFile("repo", "a.ts");
      await index.indexSymbols([
        makeChunk({ id: "c3", repositoryId: "repo", relativePath: "a.ts", symbolKind: "interface", headingPath: ["IWidget"] })
      ]);
      const rows = storage.getDatabase().prepare("SELECT * FROM symbols").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].chunk_id).toBe("c3");
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("removeSymbolsForFile deletes only that file's rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const index = SqliteSymbolIndex.attach(storage.getDatabase());

      await index.indexSymbols([
        makeChunk({ id: "c1", repositoryId: "repo", relativePath: "a.ts", symbolKind: "class", headingPath: ["A"] }),
        makeChunk({ id: "c2", repositoryId: "repo", relativePath: "b.ts", symbolKind: "class", headingPath: ["B"] })
      ]);
      await index.removeSymbolsForFile("repo", "a.ts");
      const rows = storage.getDatabase().prepare("SELECT * FROM symbols").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].relative_path).toBe("b.ts");
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });

  it("deleteByRepository deletes all rows for a repo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sym-"));
    let storage: SqliteStorage | undefined;
    try {
      storage = await SqliteStorage.open(dir);
      const index = SqliteSymbolIndex.attach(storage.getDatabase());

      await index.indexSymbols([
        makeChunk({ id: "c1", repositoryId: "repo-a", relativePath: "a.ts", symbolKind: "class", headingPath: ["A"] }),
        makeChunk({ id: "c2", repositoryId: "repo-b", relativePath: "b.ts", symbolKind: "class", headingPath: ["B"] })
      ]);
      await index.deleteByRepository("repo-a");
      const rows = storage.getDatabase().prepare("SELECT * FROM symbols").all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].repository_id).toBe("repo-b");
    } finally {
      storage?.close();
      await rmWithRetry(dir);
    }
  });
});
