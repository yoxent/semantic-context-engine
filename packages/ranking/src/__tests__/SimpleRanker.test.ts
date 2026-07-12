import { describe, expect, it } from "vitest";
import { SimpleRanker } from "../SimpleRanker.js";

describe("SimpleRanker", () => {
  it("boosts file and heading matches and applies limit", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        { chunkId: "a", score: 1, strategy: "keyword", snippet: "body", path: "Notes.md", startLine: 1, endLine: 1 },
        { chunkId: "b", score: 1, strategy: "keyword", snippet: "# Architecture", path: "Architecture.md", startLine: 1, endLine: 2 }
      ],
      { text: "Architecture", limit: 1 }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.chunkId).toBe("b");
  });
});
