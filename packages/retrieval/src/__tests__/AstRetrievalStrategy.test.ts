import { describe, expect, it, vi } from "vitest";
import { AstRetrievalStrategy } from "../AstRetrievalStrategy.js";
import type { ISymbolIndex, IMetadataStore, Chunk, SymbolHit } from "@sce/core";

function makeStubDeps(overrides: Partial<{ symbolIndex: ISymbolIndex; metadataStore: IMetadataStore }> = {}) {
  return {
    symbolIndex: {
      indexSymbols: vi.fn(),
      removeSymbolsForFile: vi.fn(),
      deleteByRepository: vi.fn(),
      searchSymbols: vi.fn().mockResolvedValue([])
    } as unknown as ISymbolIndex,
    metadataStore: {
      saveRepository: vi.fn(),
      getRepository: vi.fn(),
      deleteRepository: vi.fn(),
      saveFile: vi.fn(),
      getFile: vi.fn(),
      listFiles: vi.fn(),
      deleteFile: vi.fn(),
      saveChunks: vi.fn(),
      getChunk: vi.fn(),
      getChunks: vi.fn().mockResolvedValue([]),
      deleteChunksForFile: vi.fn(),
      getStatistics: vi.fn()
    } as unknown as IMetadataStore,
    defaultLimit: 10,
    maxSnippetChars: 200,
    ...overrides
  };
}

function makeChunk(overrides: Partial<Chunk> & { id: string }): Chunk {
  return {
    repositoryId: "repo",
    relativePath: "a.ts",
    language: "typescript",
    startLine: 1,
    endLine: 3,
    text: "class Widget {}",
    fileHash: "h",
    timestamp: new Date("2026-07-13T00:00:00.000Z"),
    headingPath: ["Widget"],
    symbolKind: "class",
    ...overrides
  } as Chunk;
}

function makeSymbolHit(overrides: Partial<SymbolHit> & { chunkId: string }): SymbolHit {
  return {
    symbolKind: "class",
    name: "Widget",
    qualifiedName: "Widget",
    relativePath: "a.ts",
    matchType: "exact",
    ...overrides
  };
}

describe("AstRetrievalStrategy", () => {
  it("rejects empty text", async () => {
    const strategy = new AstRetrievalStrategy(makeStubDeps());
    await expect(strategy.search({ text: "" })).rejects.toThrow(/non-empty symbol name/);
  });

  it("rejects whitespace-only text", async () => {
    const strategy = new AstRetrievalStrategy(makeStubDeps());
    await expect(strategy.search({ text: "   " })).rejects.toThrow(/non-empty symbol name/);
  });

  it("exact match scores 1.0", async () => {
    const symbolHits = [makeSymbolHit({ chunkId: "c1", matchType: "exact" })];
    const deps = makeStubDeps({
      symbolIndex: { searchSymbols: vi.fn().mockResolvedValue(symbolHits) } as unknown as ISymbolIndex,
      metadataStore: { getChunks: vi.fn().mockResolvedValue([makeChunk({ id: "c1" })]) } as unknown as IMetadataStore
    });
    const strategy = new AstRetrievalStrategy(deps);
    const result = await strategy.search({ text: "Widget", limit: 10 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].score).toBe(1.0);
    expect(result.hits[0].strategy).toBe("ast");
    expect(result.hits[0].symbolKind).toBe("class");
  });

  it("prefix match scores 0.5 + matchedLength/nameLength", async () => {
    const symbolHits = [makeSymbolHit({ chunkId: "c1", matchType: "prefix", name: "renderView" })];
    const deps = makeStubDeps({
      symbolIndex: { searchSymbols: vi.fn().mockResolvedValue(symbolHits) } as unknown as ISymbolIndex,
      metadataStore: { getChunks: vi.fn().mockResolvedValue([makeChunk({ id: "c1", text: "function renderView() {}" })]) } as unknown as IMetadataStore
    });
    const strategy = new AstRetrievalStrategy(deps);
    const result = await strategy.search({ text: "rend", limit: 10 });
    expect(result.hits[0].score).toBeCloseTo(0.5 + 4 / 10); // 0.9
  });

  it("forwards filters to searchSymbols", async () => {
    const searchSymbols = vi.fn().mockResolvedValue([]);
    const deps = makeStubDeps({ symbolIndex: { searchSymbols } as unknown as ISymbolIndex });
    const strategy = new AstRetrievalStrategy(deps);
    await strategy.search({ text: "Widget", symbolKind: "class", repositoryIds: ["r1"], pathFilter: "src/*.ts", language: "typescript", limit: 5 });
    expect(searchSymbols).toHaveBeenCalledWith({
      name: "Widget",
      symbolKind: "class",
      repositoryIds: ["r1"],
      pathFilter: "src/*.ts",
      language: "typescript",
      limit: 5
    });
  });

  it("drops missing chunks on hydrate", async () => {
    const symbolHits = [makeSymbolHit({ chunkId: "c1" })];
    const deps = makeStubDeps({
      symbolIndex: { searchSymbols: vi.fn().mockResolvedValue(symbolHits) } as unknown as ISymbolIndex,
      metadataStore: { getChunks: vi.fn().mockResolvedValue([]) } as unknown as IMetadataStore // chunk missing
    });
    const strategy = new AstRetrievalStrategy(deps);
    const result = await strategy.search({ text: "Widget", limit: 10 });
    expect(result.hits).toHaveLength(0);
  });

  it("respects limit", async () => {
    const symbolHits = Array.from({ length: 5 }, (_, i) => makeSymbolHit({ chunkId: `c${i}`, name: `W${i}` }));
    const chunks = symbolHits.map((h) => makeChunk({ id: h.chunkId, headingPath: [h.name] }));
    const deps = makeStubDeps({
      symbolIndex: { searchSymbols: vi.fn().mockResolvedValue(symbolHits) } as unknown as ISymbolIndex,
      metadataStore: { getChunks: vi.fn().mockResolvedValue(chunks) } as unknown as IMetadataStore
    });
    const strategy = new AstRetrievalStrategy(deps);
    const result = await strategy.search({ text: "W", limit: 2 });
    expect(result.hits).toHaveLength(2);
  });

  it("diagnostics includes strategy and scannedChunks", async () => {
    const symbolHits = [makeSymbolHit({ chunkId: "c1" }), makeSymbolHit({ chunkId: "c1" })]; // duplicate chunkId
    const deps = makeStubDeps({
      symbolIndex: { searchSymbols: vi.fn().mockResolvedValue(symbolHits) } as unknown as ISymbolIndex,
      metadataStore: { getChunks: vi.fn().mockResolvedValue([makeChunk({ id: "c1" })]) } as unknown as IMetadataStore
    });
    const strategy = new AstRetrievalStrategy(deps);
    const result = await strategy.search({ text: "Widget", limit: 10 });
    expect(result.diagnostics?.strategy).toBe("ast");
    expect(result.diagnostics?.scannedChunks).toBe(1); // unique
    expect(result.diagnostics?.elapsedMs).toBeDefined();
  });
});
