export interface VectorUpsert {
  chunkId: string;
  repositoryId: string;
  relativePath: string;
  model: string;
  dimensions: number;
  vector: number[];
}

export interface VectorSearchQuery {
  repositoryIds?: string[];
  vector: number[];
  limit: number;
  model: string;
  dimensions: number;
}

export interface VectorSearchHit {
  chunkId: string;
  score: number;
}

export interface ModelDimensions {
  model: string;
  dimensions: number;
}

export interface IVectorStore {
  upsert(entry: VectorUpsert): Promise<void>;
  search(query: VectorSearchQuery): Promise<VectorSearchHit[]>;
  deleteByChunk(chunkId: string): Promise<void>;
  deleteByRepository(repositoryId: string): Promise<void>;
  deleteByFile(repositoryId: string, relativePath: string): Promise<void>;
  /** Returns the model+dimensions currently stored for a repository, or undefined if none. */
  getModelDimensions(repositoryId: string): Promise<ModelDimensions | undefined>;
}