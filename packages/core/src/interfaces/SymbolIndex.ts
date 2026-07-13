import type { Chunk } from "../models/Chunk.js";
import type { SymbolHit } from "../models/SymbolHit.js";
import type { SymbolSearchQuery } from "../models/SymbolSearchQuery.js";

export interface ISymbolIndex {
  indexSymbols(chunks: Chunk[]): Promise<void>;
  removeSymbolsForFile(repositoryId: string, relativePath: string): Promise<void>;
  deleteByRepository(repositoryId: string): Promise<void>;
  searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]>;
}