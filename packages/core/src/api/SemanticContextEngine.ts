import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { SearchMode, SearchQuery, SearchResult } from "../models/Search.js";

export interface SemanticContextEngineDeps {
  keywordStrategy: IRetrievalStrategy;
}

export class SemanticContextEngine {
  constructor(private readonly deps: SemanticContextEngineDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    const mode = query.mode ?? "keyword";
    if (mode !== "keyword") {
      throw new Error(`Search mode ${mode} is not implemented in v1`);
    }
    return this.keywordSearch(query);
  }

  async keywordSearch(query: SearchQuery): Promise<SearchResult> {
    return this.deps.keywordStrategy.search({ ...query, mode: "keyword" });
  }

  async semanticSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("semantic", query);
  }

  async astSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("ast", query);
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("hybrid", query);
  }

  private unsupported(mode: SearchMode, _query: SearchQuery): never {
    throw new Error(`Search mode ${mode} is not implemented in v1`);
  }
}
