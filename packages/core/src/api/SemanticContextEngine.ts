import type { IMetadataStore } from "../interfaces/Storage.js";
import type { IRetrievalStrategy } from "../interfaces/RetrievalStrategy.js";
import type { Logger } from "../logging/Logger.js";
import type { RepositoryType } from "../models/Repository.js";
import type { SearchMode, SearchQuery, SearchResult } from "../models/Search.js";
import type { EngineStatistics } from "../models/Statistics.js";
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
  semanticStrategy?: IRetrievalStrategy;
  hybridStrategy?: IRetrievalStrategy;
  indexingService?: IIndexingService;
  metadataStore?: IMetadataStore;
  logger?: Logger;
}

export class SemanticContextEngine {
  constructor(private readonly deps: SemanticContextEngineDeps) {}

  async indexRepository(input: IndexRepositoryInput): Promise<IndexRepositoryOutput> {
    if (!this.deps.indexingService) throw new Error("Indexing service is not configured");
    this.deps.logger?.debug("indexRepository.start", { rootPath: input.rootPath, type: input.type });
    const result = await this.deps.indexingService.indexRepository(input);
    this.deps.logger?.debug("indexRepository.done", {
      repositoryId: result.repositoryId,
      filesIndexed: result.filesIndexed,
      chunksIndexed: result.chunksIndexed
    });
    return result;
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
    if (mode === "keyword") return this.keywordSearch(query);
    if (mode === "semantic") return this.semanticSearch(query);
    if (mode === "hybrid") return this.hybridSearch(query);
    return this.unsupported(mode, query);
  }

  async keywordSearch(query: SearchQuery): Promise<SearchResult> {
    const result = await this.deps.keywordStrategy.search({ ...query, mode: "keyword" });
    this.deps.logger?.debug("search.done", {
      text: query.text,
      hits: result.hits.length,
      elapsedMs: result.diagnostics?.elapsedMs,
      repositoryIds: query.repositoryIds,
      pathFilter: query.pathFilter,
      language: query.language
    });
    return result;
  }

  async semanticSearch(query: SearchQuery): Promise<SearchResult> {
    if (!this.deps.semanticStrategy) {
      throw new Error("Semantic search is not configured (sce.config.json missing 'embedding' block)");
    }
    return this.deps.semanticStrategy.search({ ...query, mode: "semantic" });
  }

  async astSearch(query: SearchQuery): Promise<SearchResult> {
    return this.unsupported("ast", query);
  }

  async hybridSearch(query: SearchQuery): Promise<SearchResult> {
    if (!this.deps.hybridStrategy) {
      throw new Error("Hybrid search is not configured (sce.config.json missing 'embedding' block)");
    }
    return this.deps.hybridStrategy.search({ ...query, mode: "hybrid" });
  }

  async statistics(): Promise<EngineStatistics> {
    if (!this.deps.metadataStore) throw new Error("Metadata store is not configured");
    return this.deps.metadataStore.getStatistics();
  }

  private unsupported(mode: SearchMode, _query: SearchQuery): never {
    throw new Error(`Search mode ${mode} is not implemented in v1`);
  }
}
