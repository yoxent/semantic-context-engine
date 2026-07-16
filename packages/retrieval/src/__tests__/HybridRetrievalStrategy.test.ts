import { describe, expect, it } from "vitest";
import { HybridRetrievalStrategy } from "../HybridRetrievalStrategy.js";
import type { IRetrievalStrategy, SearchHit, SearchQuery } from "@sce/core";

function hit(chunkId: string, strategy: "keyword" | "semantic", path: string): SearchHit {
  return {
    chunkId,
    score: 0,
    strategy,
    snippet: `snippet-${chunkId}`,
    path,
    startLine: 1,
    endLine: 2
  };
}

/** Builds a stub child strategy that records the query it received and returns canned ranked hits. */
function stubStrategy(
  name: "keyword" | "semantic",
  hits: SearchHit[],
  received: SearchQuery[] = []
): IRetrievalStrategy {
  return {
    name,
    search: async (query) => {
      received.push(query);
      return { hits, diagnostics: { strategy: name, scannedChunks: hits.length } };
    }
  };
}

const RRF_K = 60;
const term = (rank: number) => 1 / (RRF_K + rank);

describe("HybridRetrievalStrategy", () => {
  it("rejects pathFilter and language with a clear unsupported-filter error", async () => {
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", []),
      semanticStrategy: stubStrategy("semantic", []),
      defaultLimit: 10
    });
    await expect(strategy.search({ text: "x", pathFilter: "notes/*" })).rejects.toThrow(/pathFilter.*hybrid|hybrid.*pathFilter/i);
    await expect(strategy.search({ text: "x", language: "markdown" })).rejects.toThrow(/language.*hybrid|hybrid.*language/i);
    await expect(strategy.search({ text: "x", symbolKind: "class" })).rejects.toThrow(/symbolKind.*hybrid|hybrid.*symbolKind/i);
  });

  it("over-fetches each side with max(limit*2, 20) and cuts to the requested limit", async () => {
    const kwReceived: SearchQuery[] = [];
    const semReceived: SearchQuery[] = [];
    const kwHits = ["a", "b", "c", "d", "e"].map((id) => hit(id, "keyword", `k/${id}.md`));
    const semHits = ["f", "g", "h", "i", "j"].map((id) => hit(id, "semantic", `s/${id}.md`));

    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits, kwReceived),
      semanticStrategy: stubStrategy("semantic", semHits, semReceived),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 5 });

    expect(kwReceived[0]?.limit).toBe(20); // max(5*2, 20) = 20
    expect(semReceived[0]?.limit).toBe(20);
    expect(kwReceived[0]?.mode).toBe("keyword");
    expect(semReceived[0]?.mode).toBe("semantic");
    expect(result.hits).toHaveLength(5); // cut to limit
  });

  it("uses defaultLimit when query.limit is omitted (candidateLimit = max(defaultLimit*2, 20))", async () => {
    const kwReceived: SearchQuery[] = [];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", [], kwReceived),
      semanticStrategy: stubStrategy("semantic", []),
      defaultLimit: 15
    });
    await strategy.search({ text: "x" });
    expect(kwReceived[0]?.limit).toBe(30); // max(15*2, 20) = 30
  });

  it("fuses disjoint lists with RRF and boosts chunks present on both sides", async () => {
    // keyword ranks: A(1), B(2), C(3)
    // semantic ranks: D(1), B(2), A(3)
    const kwHits = [hit("A", "keyword", "k/A.md"), hit("B", "keyword", "k/B.md"), hit("C", "keyword", "k/C.md")];
    const semHits = [hit("D", "semantic", "s/D.md"), hit("B", "semantic", "s/B.md"), hit("A", "semantic", "s/A.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });

    const ids = result.hits.map((h) => h.chunkId);
    // A and B appear on both sides and must outrank the single-side hits D and C.
    expect(ids.slice(0, 2).sort()).toEqual(["A", "B"]);
    expect(result.hits[0]?.score).toBeCloseTo(term(1) + term(3), 10); // A: kw rank1 + sem rank3
    // A edges B because 1/61 + 1/63 > 1/62 + 1/62
    expect(result.hits[0]?.chunkId).toBe("A");
    expect(result.hits[1]?.chunkId).toBe("B");
  });

  it("breaks remaining fused-score ties by chunkId ascending", async () => {
    // keyword: X(1), Y(2) ; semantic: Y(1), X(2)
    // X = 1/61 + 1/62 ; Y = 1/62 + 1/61  -> identical fused scores, a perfect tie.
    const kwHits = [hit("X", "keyword", "k/X.md"), hit("Y", "keyword", "k/Y.md")];
    const semHits = [hit("Y", "semantic", "s/Y.md"), hit("X", "semantic", "s/X.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    // Same fused score -> chunkId asc: X before Y
    expect(result.hits.map((h) => h.chunkId)).toEqual(["X", "Y"]);
    expect(result.hits[0]?.score).toBeCloseTo(term(1) + term(2), 10);
    expect(result.hits[1]?.score).toBeCloseTo(term(1) + term(2), 10);
  });

  it("prefers the keyword payload on a per-chunk RRF-term tie", async () => {
    // Both sides rank X at rank 1 -> equal terms -> tie -> keyword payload wins.
    const kwHits = [hit("X", "keyword", "k/X.md")];
    const semHits = [hit("X", "semantic", "s/X.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.path).toBe("k/X.md");
  });

  it("prefers the side with the larger individual RRF term for the same chunk", async () => {
    // keyword: X(1), Y(2) ; semantic: Y(1)
    // For Y: kw term 1/62 < sem term 1/61 -> prefer semantic payload for Y.
    // For X: only keyword -> keyword payload.
    const kwHits = [hit("X", "keyword", "k/X.md"), hit("Y", "keyword", "k/Y.md")];
    const semHits = [hit("Y", "semantic", "s/Y.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    const byId = new Map(result.hits.map((h) => [h.chunkId, h] as const));
    expect(byId.get("X")?.path).toBe("k/X.md");
    expect(byId.get("Y")?.path).toBe("s/Y.md");
  });

  it("marks every fused hit as strategy 'hybrid' with the fused RRF score", async () => {
    const kwHits = [hit("A", "keyword", "k/A.md")];
    const semHits = [hit("A", "semantic", "s/A.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    expect(result.hits[0]?.strategy).toBe("hybrid");
    expect(result.hits[0]?.score).toBeCloseTo(term(1) + term(1), 10);
  });

  it("forwards repositoryIds to both child strategies", async () => {
    const kwReceived: SearchQuery[] = [];
    const semReceived: SearchQuery[] = [];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", [], kwReceived),
      semanticStrategy: stubStrategy("semantic", [], semReceived),
      defaultLimit: 10
    });
    await strategy.search({ text: "x", repositoryIds: ["repo-1", "repo-2"] });
    expect(kwReceived[0]?.repositoryIds).toEqual(["repo-1", "repo-2"]);
    expect(semReceived[0]?.repositoryIds).toEqual(["repo-1", "repo-2"]);
  });

  it("reports hybrid diagnostics with elapsedMs and unique scannedChunks before the final cut", async () => {
    // 3 unique chunk ids across both sides (A, B, C), limit 2 -> 2 hits but scannedChunks = 3.
    const kwHits = [hit("A", "keyword", "k/A.md"), hit("B", "keyword", "k/B.md")];
    const semHits = [hit("B", "semantic", "s/B.md"), hit("C", "semantic", "s/C.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 2 });
    expect(result.diagnostics?.strategy).toBe("hybrid");
    expect(result.diagnostics?.scannedChunks).toBe(3); // unique across both sides, before cut
    expect(typeof result.diagnostics?.elapsedMs).toBe("number");
    expect(result.hits).toHaveLength(2);
  });

  it("propagates failures from a child strategy instead of returning a one-sided result", async () => {
    const failing: IRetrievalStrategy = {
      name: "semantic",
      search: async () => {
        throw new Error("embedding provider down");
      }
    };
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", [hit("A", "keyword", "k/A.md")]),
      semanticStrategy: failing,
      defaultLimit: 10
    });
    await expect(strategy.search({ text: "x" })).rejects.toThrow(/embedding provider down/);
  });
});
