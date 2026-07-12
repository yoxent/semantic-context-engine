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
