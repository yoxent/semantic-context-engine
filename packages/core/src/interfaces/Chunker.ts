import type { Chunk } from "../models/Chunk.js";

export interface ChunkInput {
  repositoryId: string;
  relativePath: string;
  language: string;
  fileHash: string;
  text: string;
}

export interface IChunker {
  chunk(input: ChunkInput): Chunk[];
}
