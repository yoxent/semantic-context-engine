import { mkdtemp, cp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { sceIndexRepository, sceSearch, sceStats } from "../tools.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("MCP tool handlers", () => {
  it("indexes and searches through core adapters", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-mcp-"));
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const indexed = await sceIndexRepository({ path: dir, type: "vault" });
      expect(indexed.filesIndexed).toBe(3);

      const result = await sceSearch({ path: dir, query: "concise snippets", limit: 5 });
      expect(result.hits[0]?.path).toBe("Agent-Context.md");

      const stats = await sceStats({ path: dir });
      expect(stats.fileCount).toBe(3);
      expect(stats.repositoryCount).toBe(1);
    } finally {
      await rmWithRetry(dir);
    }
  });

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

  it("surfaces hybrid-not-configured when mode=hybrid and embedding is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-mcp-hyb-"));
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await expect(sceSearch({ path: dir, query: "vectors", mode: "hybrid" })).rejects.toThrow(
        /Hybrid search is not configured/
      );
    } finally {
      await rmWithRetry(dir);
    }
  });
});
