import { describe, expect, it } from "vitest";
import { SemanticContextEngine } from "./SemanticContextEngine.js";
import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { SearchHit, SearchQuery } from "../models/Search.js";

describe("SemanticContextEngine", () => {
  it("routes generic search to keyword strategy in v1", async () => {
    const calls: SearchQuery[] = [];
    const keyword: IRetrievalStrategy = {
      name: "keyword",
      search: async (query) => {
        calls.push(query);
        const hit: SearchHit = {
          chunkId: "chunk-1",
          score: 1,
          strategy: "keyword",
          snippet: "retrieval framework",
          path: "README.md",
          startLine: 1,
          endLine: 3
        };
        return { hits: [hit], diagnostics: { strategy: "keyword" } };
      }
    };

    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    const result = await engine.search({ text: "retrieval", limit: 5 });

    expect(calls).toEqual([{ text: "retrieval", limit: 5, mode: "keyword" }]);
    expect(result.hits[0]?.chunkId).toBe("chunk-1");
    expect(result.diagnostics?.strategy).toBe("keyword");
  });

  it("rejects unsupported explicit modes until implemented", async () => {
    const keyword: IRetrievalStrategy = {
      name: "keyword",
      search: async () => ({ hits: [] })
    };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });

    await expect(engine.search({ text: "architecture", mode: "semantic" })).rejects.toThrow(
      "Search mode semantic is not implemented in v1"
    );
  });
});
