import { describe, expect, it } from "vitest";
import { SemanticRetrievalStrategy } from "../SemanticRetrievalStrategy.js";
import type { Chunk, IEmbeddingProvider, IMetadataStore, IRanker, IVectorStore, SearchQuery } from "@sce/core";

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "chunk-1",
    repositoryId: "repo-a",
    relativePath: "Notes/Alpha.md",
    language: "markdown",
    startLine: 1,
    endLine: 4,
    text: "# Alpha\nSemantic notes about vectors.",
    fileHash: "h",
    timestamp: new Date("2026-07-13T00:00:00.000Z"),
    headingPath: ["Alpha"],
    ...overrides
  };
}

const embedding: IEmbeddingProvider = {
  embed: async (texts: string[]) => texts.map((t) => (t === "nomatch" ? [0.0, 0.0] : [0.0, 1.0]))
};

const vectorStore: IVectorStore = {
  upsert: async () => undefined,
  search: async (q) =>
    q.vector[1] === 1
      ? [{ chunkId: "chunk-1", score: 0.9 }, { chunkId: "chunk-2", score: 0.7 }]
      : [],
  deleteByChunk: async () => undefined,
  deleteByRepository: async () => undefined,
  deleteByFile: async () => undefined,
  getModelDimensions: async () => ({ model: "m", dimensions: 2 })
};

const metadataStore: IMetadataStore = {
  saveRepository: async () => undefined,
  getRepository: async () => undefined,
  deleteRepository: async () => undefined,
  saveFile: async () => undefined,
  getFile: async () => undefined,
  listFiles: async () => [],
  deleteFile: async () => undefined,
  saveChunks: async () => undefined,
  getChunk: async () => undefined,
  getChunks: async (ids) => [makeChunk({ id: ids[0] ?? "chunk-1" })],
  deleteChunksForFile: async () => undefined,
  getStatistics: async () => ({
    repositoryCount: 0,
    fileCount: 0,
    chunkCount: 0,
    linkCount: 0,
    repositories: []
  })
};

const ranker: IRanker = {
  rank: (hits, _query) => hits.map((hit) => ({ ...hit, score: hit.score + 2 }))
};

describe("SemanticRetrievalStrategy", () => {
  it("embeds the query, searches vectors, hydrates chunks, and ranks", async () => {
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 10,
      maxSnippetChars: 500
    });
    const result = await strategy.search({ text: "vectors", limit: 5 });

    expect(result.diagnostics?.strategy).toBe("semantic");
    expect(result.hits[0]?.chunkId).toBe("chunk-1");
    expect(result.hits[0]?.strategy).toBe("semantic");
    expect(result.hits[0]?.path).toBe("Notes/Alpha.md");
    expect(result.hits[0]?.headingPath).toEqual(["Alpha"]);
    // ranker added +2
    expect(result.hits[0]?.score).toBeCloseTo(0.9 + 2, 6);
  });

  it("rejects pathFilter and language with a clear unsupported-filter error", async () => {
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 10,
      maxSnippetChars: 500
    });
    await expect(strategy.search({ text: "x", pathFilter: "notes/*" })).rejects.toThrow(/pathFilter.*semantic|semantic.*pathFilter/i);
    await expect(strategy.search({ text: "x", language: "markdown" })).rejects.toThrow(/language.*semantic|semantic.*language/i);
  });

  it("uses defaultLimit from config when query.limit is omitted", async () => {
    let observedLimit = 0;
    const store: IVectorStore = {
      ...vectorStore,
      search: async (q) => {
        observedLimit = q.limit;
        return [];
      }
    };
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore: store,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 7,
      maxSnippetChars: 500
    });
    await strategy.search({ text: "x" });
    expect(observedLimit).toBe(7);
  });

  it("returns an empty result when no vectors match", async () => {
    const strategy = new SemanticRetrievalStrategy({
      embeddingProvider: embedding,
      vectorStore,
      metadataStore,
      ranker,
      model: "m",
      dimensions: 2,
      defaultLimit: 10,
      maxSnippetChars: 500
    });
    const result = await strategy.search({ text: "nomatch" });
    expect(result.hits).toEqual([]);
  });
});
