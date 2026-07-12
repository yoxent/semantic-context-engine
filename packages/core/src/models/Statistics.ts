export interface EngineStatistics {
  repositoryCount: number;
  fileCount: number;
  chunkCount: number;
  linkCount: number;
  /** ISO timestamp of the most recently indexed repository, if any. */
  lastIndexedAt?: string;
  repositories: Array<{
    id: string;
    rootPath: string;
    type: string;
    indexedAt: string;
    fileCount: number;
    chunkCount: number;
  }>;
}
