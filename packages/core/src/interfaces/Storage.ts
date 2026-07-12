import type { Chunk } from "../models/Chunk.js";
import type { Repository } from "../models/Repository.js";
import type { SearchHit, SearchQuery } from "../models/Search.js";

export interface FileRecord {
  repositoryId: string;
  relativePath: string;
  language: string;
  fileHash: string;
  indexedAt: Date;
}

export interface IMetadataStore {
  saveRepository(repository: Repository): Promise<void>;
  getRepository(id: string): Promise<Repository | undefined>;
  deleteRepository(id: string): Promise<void>;
  saveFile(record: FileRecord): Promise<void>;
  getFile(repositoryId: string, relativePath: string): Promise<FileRecord | undefined>;
  listFiles(repositoryId: string): Promise<FileRecord[]>;
  deleteFile(repositoryId: string, relativePath: string): Promise<void>;
  saveChunks(chunks: Chunk[]): Promise<void>;
  getChunk(id: string): Promise<Chunk | undefined>;
  deleteChunksForFile(repositoryId: string, relativePath: string): Promise<void>;
}

export interface IKeywordIndex {
  indexChunks(chunks: Chunk[]): Promise<void>;
  removeChunksForFile(repositoryId: string, relativePath: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchHit[]>;
}
