import { describe, expect, it } from "vitest";
import { KeywordRetrievalStrategy } from "../KeywordRetrievalStrategy.js";

describe("KeywordRetrievalStrategy", () => {
  it("searches keyword index and ranks hits", async () => {
    const strategy = new KeywordRetrievalStrategy({
      keywordIndex: {
        search: async () => [
          { chunkId: "chunk-1", score: 1, strategy: "keyword", snippet: "SQLite metadata", path: "Architecture.md", startLine: 1, endLine: 2 }
        ],
        indexChunks: async () => undefined,
        removeChunksForFile: async () => undefined
      },
      ranker: {
        rank: (hits) => hits.map((hit) => ({ ...hit, score: hit.score + 10 }))
      }
    });

    const result = await strategy.search({ text: "SQLite", limit: 5 });

    expect(result.hits[0]?.score).toBe(11);
    expect(result.diagnostics?.strategy).toBe("keyword");
  });

  it("rejects symbolKind with a clear unsupported-filter error", async () => {
    const strategy = new KeywordRetrievalStrategy({
      keywordIndex: { search: async () => [], indexChunks: async () => undefined, removeChunksForFile: async () => undefined },
      ranker: { rank: (hits) => hits }
    });
    await expect(strategy.search({ text: "x", symbolKind: "class" })).rejects.toThrow(/symbolKind.*keyword|keyword.*symbolKind/i);
  });
});
