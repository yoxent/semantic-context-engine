import { describe, expect, it } from "vitest";
import type { SearchHit } from "@sce/core";
import { SimpleRanker } from "../SimpleRanker.js";

function hit(overrides: Partial<SearchHit> & Pick<SearchHit, "chunkId">): SearchHit {
  return {
    score: 1,
    strategy: "keyword",
    snippet: "body",
    path: "Notes.md",
    startLine: 1,
    endLine: 1,
    ...overrides
  };
}

describe("SimpleRanker", () => {
  it("boosts file and heading matches and applies limit", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        hit({ chunkId: "a", snippet: "body", path: "Notes.md" }),
        hit({ chunkId: "b", snippet: "# Architecture", path: "Architecture.md", startLine: 1, endLine: 2 })
      ],
      { text: "Architecture", limit: 1 }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.chunkId).toBe("b");
  });

  it("boosts basename matches over directory-path-only matches", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        hit({
          chunkId: "dir",
          score: 10,
          path: "architecture/overview.md",
          snippet: "general notes"
        }),
        hit({
          chunkId: "base",
          score: 10,
          path: "notes/Architecture.md",
          snippet: "general notes"
        })
      ],
      { text: "Architecture" }
    );

    expect(ranked.map((h) => h.chunkId)).toEqual(["base", "dir"]);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("boosts heading-path segment matches", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        hit({
          chunkId: "body-only",
          score: 10,
          path: "Guide.md",
          snippet: "mentions sqlite in body text",
          headingPath: ["Intro"]
        }),
        hit({
          chunkId: "heading",
          score: 10,
          path: "Guide.md",
          snippet: "storage details",
          headingPath: ["Storage", "SQLite"]
        })
      ],
      { text: "SQLite" }
    );

    expect(ranked[0]?.chunkId).toBe("heading");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("boosts exact-phrase and identifier-like snippet matches", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        hit({
          chunkId: "loose",
          score: 10,
          path: "a.md",
          snippet: "create an engine helper"
        }),
        hit({
          chunkId: "exact",
          score: 10,
          path: "b.md",
          snippet: "call createEngine() next"
        })
      ],
      { text: "createEngine" }
    );

    expect(ranked[0]?.chunkId).toBe("exact");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("preserves stable ordering on score ties", () => {
    const ranker = new SimpleRanker();
    const ranked = ranker.rank(
      [
        hit({ chunkId: "z", score: 5, path: "z.md", snippet: "same" }),
        hit({ chunkId: "a", score: 5, path: "a.md", snippet: "same" }),
        hit({ chunkId: "m", score: 5, path: "a.md", snippet: "same" })
      ],
      { text: "unrelated-query-xyz" }
    );

    expect(ranked.map((h) => h.chunkId)).toEqual(["a", "m", "z"]);
  });
});
