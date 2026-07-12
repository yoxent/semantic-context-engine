export interface VectorSearchQuery {
  repositoryIds?: string[];
  vector: number[];
  limit: number;
}

export interface VectorSearchHit {
  chunkId: string;
  score: number;
}

export interface IVectorStore {
  upsert(chunkId: string, vector: number[]): Promise<void>;
  search(query: VectorSearchQuery): Promise<VectorSearchHit[]>;
  delete(chunkId: string): Promise<void>;
}
