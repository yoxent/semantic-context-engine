import type { IMetadataStore } from "../interfaces/Storage.js";
import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { RepositoryType } from "../models/Repository.js";
import type { SearchMode, SearchQuery, SearchResult } from "../models/Search.js";
import type { Chunk } from "../models/Chunk.js";

export interface IndexRepositoryInput {
  rootPath: string;
  type: RepositoryType;
}

export interface IndexRepositoryOutput {
  repositoryId: string;
  filesIndexed: number;
  chunksIndexed: number;
}

export interface IIndexingService {
  indexRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput>;
}

export interface SemanticContextEngineDeps {
  keywordStrategy: IRetrievalStrategy;
  indexingService?: IIndexingService;
  metadataStore?: IMetadataStore;
}

export class SemanticContextEngine {
  constructor(private readonly deps: SemanticContextEngineDeps) {}

  async indexRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput> {
    if (!this.deps.indexingService) throw new Error("Indexing service is not configured");
    return this.deps.indexingService.indexRepository(input);
  }

  async updateRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput> {
    return this.indexRepository(input);
  }

  async getChunk(id: string): Promise<Chunk> {
    if (!this.deps.metadataStore) throw new Error("Metadata store is not configured");
    const chunk = await this.deps.metadataStore.getChunk(id);
    if (!chunk) throw new Error(`Chunk not found: ${id}`);
    return chunk;
  }

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
