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

  it("throws a clear error when semantic is requested but not configured", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    await expect(engine.search({ text: "architecture", mode: "semantic" })).rejects.toThrow(
      /Semantic search is not configured/
    );
  });

  it("rejects ast as unimplemented and hybrid as not-configured when no hybrid strategy is wired", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    await expect(engine.search({ text: "x", mode: "ast" })).rejects.toThrow(/Search mode ast is not implemented in v1/);
    await expect(engine.search({ text: "x", mode: "hybrid" })).rejects.toThrow(/Hybrid search is not configured/);
  });

  it("delegates indexRepository and getChunk when configured", async () => {
    const keyword: IRetrievalStrategy = {
      name: "keyword",
      search: async () => ({ hits: [] })
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: keyword,
      indexingService: {
        indexRepository: async () => ({
          repositoryId: "repo-1",
          filesIndexed: 2,
          chunksIndexed: 4
        })
      },
      metadataStore: {
        saveRepository: async () => undefined,
        getRepository: async () => undefined,
        deleteRepository: async () => undefined,
        saveFile: async () => undefined,
        getFile: async () => undefined,
        listFiles: async () => [],
        deleteFile: async () => undefined,
        saveChunks: async () => undefined,
        getChunk: async (id) =>
          id === "chunk-1"
            ? {
                id: "chunk-1",
                repositoryId: "repo-1",
                relativePath: "README.md",
                startLine: 1,
                endLine: 2,
                text: "hello",
                language: "markdown",
                fileHash: "abc",
                timestamp: new Date("2026-01-01T00:00:00.000Z")
              }
            : undefined,
        getChunks: async () => [],
        deleteChunksForFile: async () => undefined,
        getStatistics: async () => ({
          repositoryCount: 1,
          fileCount: 2,
          chunkCount: 4,
          linkCount: 0,
          lastIndexedAt: "2026-01-01T00:00:00.000Z",
          repositories: [
            {
              id: "repo-1",
              rootPath: "/vault",
              type: "vault",
              indexedAt: "2026-01-01T00:00:00.000Z",
              fileCount: 2,
              chunkCount: 4
            }
          ]
        })
      }
    });

    await expect(engine.indexRepository({ rootPath: "/vault", type: "vault" })).resolves.toMatchObject({
      repositoryId: "repo-1",
      filesIndexed: 2,
      chunksIndexed: 4
    });
    await expect(engine.getChunk("chunk-1")).resolves.toMatchObject({ text: "hello" });
    await expect(engine.getChunk("missing")).rejects.toThrow("Chunk not found: missing");
    await expect(engine.statistics()).resolves.toMatchObject({
      repositoryCount: 1,
      fileCount: 2,
      chunkCount: 4
    });
  });

  it("requires indexing and metadata deps for write/read helpers", async () => {
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) }
    });
    await expect(engine.indexRepository({ rootPath: "/vault", type: "vault" })).rejects.toThrow(
      "Indexing service is not configured"
    );
    await expect(engine.getChunk("chunk-1")).rejects.toThrow("Metadata store is not configured");
    await expect(engine.statistics()).rejects.toThrow("Metadata store is not configured");
  });
});

describe("SemanticContextEngine semantic routing", () => {
  it("routes semantic mode to the semantic strategy when configured", async () => {
    const calls: SearchQuery[] = [];
    const semantic: IRetrievalStrategy = {
      name: "semantic",
      search: async (query) => {
        calls.push(query);
        return { hits: [{ chunkId: "c2", score: 0.5, strategy: "semantic", snippet: "semantic hit", path: "S.md", startLine: 1, endLine: 3 }], diagnostics: { strategy: "semantic" } };
      }
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: semantic
    });

    const result = await engine.search({ text: "vectors", mode: "semantic" });
    expect(result.hits[0]?.chunkId).toBe("c2");
    expect(calls[0]?.mode).toBe("semantic");
  });

  it("semanticSearch() delegates to the semantic strategy", async () => {
    const semantic: IRetrievalStrategy = {
      name: "semantic",
      search: async () => ({ hits: [], diagnostics: { strategy: "semantic" } })
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: semantic
    });
    const result = await engine.semanticSearch({ text: "vectors" });
    expect(result.diagnostics?.strategy).toBe("semantic");
  });

  it("keeps keyword as the default when semantic is also configured", async () => {
    let keywordCalls = 0;
    let semanticCalls = 0;
    const engine = new SemanticContextEngine({
      keywordStrategy: {
        name: "keyword",
        search: async (q) => {
          keywordCalls++;
          return { hits: [{ chunkId: "k1", score: 1, strategy: "keyword", snippet: "", path: "K.md", startLine: 1, endLine: 1 }], diagnostics: { strategy: "keyword" } };
        }
      },
      semanticStrategy: {
        name: "semantic",
        search: async () => {
          semanticCalls++;
          return { hits: [], diagnostics: { strategy: "semantic" } };
        }
      }
    });
    await engine.search({ text: "x" });
    expect(keywordCalls).toBe(1);
    expect(semanticCalls).toBe(0);
  });
});

describe("SemanticContextEngine hybrid routing", () => {
  it("throws a clear error when hybrid is requested but not configured", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({
      keywordStrategy: keyword,
      semanticStrategy: { name: "semantic", search: async () => ({ hits: [] }) }
    });
    await expect(engine.search({ text: "architecture", mode: "hybrid" })).rejects.toThrow(
      /Hybrid search is not configured/
    );
    await expect(engine.hybridSearch({ text: "architecture" })).rejects.toThrow(/Hybrid search is not configured/);
  });

  it("routes hybrid mode to the hybrid strategy when configured", async () => {
    const calls: SearchQuery[] = [];
    const hybrid: IRetrievalStrategy = {
      name: "hybrid",
      search: async (query) => {
        calls.push(query);
        return {
          hits: [{ chunkId: "h1", score: 0.03, strategy: "hybrid", snippet: "fused", path: "H.md", startLine: 1, endLine: 3 }],
          diagnostics: { strategy: "hybrid" }
        };
      }
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: { name: "semantic", search: async () => ({ hits: [] }) },
      hybridStrategy: hybrid
    });

    const result = await engine.search({ text: "cards flip", mode: "hybrid" });
    expect(result.hits[0]?.chunkId).toBe("h1");
    expect(calls[0]?.mode).toBe("hybrid");
  });

  it("hybridSearch() delegates to the hybrid strategy with mode 'hybrid'", async () => {
    const calls: SearchQuery[] = [];
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: { name: "semantic", search: async () => ({ hits: [] }) },
      hybridStrategy: {
        name: "hybrid",
        search: async (query) => {
          calls.push(query);
          return { hits: [], diagnostics: { strategy: "hybrid" } };
        }
      }
    });
    const result = await engine.hybridSearch({ text: "inventory" });
    expect(result.diagnostics?.strategy).toBe("hybrid");
    expect(calls[0]?.mode).toBe("hybrid");
  });
});
