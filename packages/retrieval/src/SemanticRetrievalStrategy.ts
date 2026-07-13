import type {
  Chunk,
  IEmbeddingProvider,
  IMetadataStore,
  IRanker,
  IRetrievalStrategy,
  IVectorStore,
  SearchHit,
  SearchQuery,
  SearchResult
} from "@sce/core";

export interface SemanticRetrievalStrategyDeps {
  embeddingProvider: IEmbeddingProvider;
  vectorStore: IVectorStore;
  metadataStore: IMetadataStore;
  ranker: IRanker;
  model: string;
  dimensions: number;
  defaultLimit: number;
  maxSnippetChars: number;
}

export class SemanticRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "semantic" as const;

  constructor(private readonly deps: SemanticRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    if (query.pathFilter !== undefined) {
      throw new Error("pathFilter is not supported in semantic mode");
    }
    if (query.language !== undefined) {
      throw new Error("language is not supported in semantic mode");
    }
    if (query.symbolKind !== undefined) {
      throw new Error("symbolKind is not supported in semantic mode");
    }

    const start = performance.now();
    const [queryVector] = await this.deps.embeddingProvider.embed([query.text]);
    if (!queryVector) {
      return { hits: [], diagnostics: { strategy: "semantic", elapsedMs: Math.round(performance.now() - start), scannedChunks: 0 } };
    }

    const limit = query.limit ?? this.deps.defaultLimit;

    const vectorHits = await this.deps.vectorStore.search({
      vector: queryVector,
      limit,
      model: this.deps.model,
      dimensions: this.deps.dimensions,
      ...(query.repositoryIds ? { repositoryIds: query.repositoryIds } : {})
    });

    if (vectorHits.length === 0) {
      return { hits: [], diagnostics: { strategy: "semantic", elapsedMs: Math.round(performance.now() - start), scannedChunks: 0 } };
    }

    const chunkIds = vectorHits.map((h) => h.chunkId);
    const chunks = await this.deps.metadataStore.getChunks(chunkIds);
    const byId = new Map(chunks.map((c) => [c.id, c] as const));

    const baseHits: SearchHit[] = vectorHits
      .map((vh) => {
        const chunk = byId.get(vh.chunkId);
        if (!chunk) return null;
        const snippet = truncate(chunk.text, this.deps.maxSnippetChars);
        const hit: SearchHit = {
          chunkId: chunk.id,
          score: vh.score,
          strategy: "semantic",
          snippet,
          path: chunk.relativePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine
        };
        if (chunk.headingPath && chunk.headingPath.length > 0) hit.headingPath = chunk.headingPath;
        return hit;
      })
      .filter((h): h is SearchHit => h !== null);

    const ranked = this.deps.ranker.rank(baseHits, { ...query, mode: "semantic" });

    return {
      hits: ranked,
      diagnostics: {
        strategy: "semantic",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: vectorHits.length
      }
    };
  }
}

function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const limit = Math.max(0, maxChars);
  if (flat.length <= limit) return flat;
  if (limit <= 3) return flat.slice(0, limit);
  return `${flat.slice(0, limit - 3)}...`;
}
