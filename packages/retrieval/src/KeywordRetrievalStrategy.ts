import type { IKeywordIndex, IRanker, IRetrievalStrategy, SearchQuery, SearchResult } from "@sce/core";

export interface KeywordRetrievalStrategyDeps {
  keywordIndex: IKeywordIndex;
  ranker: IRanker;
}

export class KeywordRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "keyword" as const;

  constructor(private readonly deps: KeywordRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    if (query.symbolKind !== undefined) {
      throw new Error("symbolKind is not supported in keyword mode");
    }
    const start = performance.now();
    const hits = await this.deps.keywordIndex.search({ ...query, mode: "keyword" });
    const ranked = this.deps.ranker.rank(hits, query);
    return {
      hits: ranked,
      diagnostics: {
        strategy: "keyword",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: hits.length
      }
    };
  }
}
