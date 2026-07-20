import type { SymbolKind } from "./SymbolKind.js";

export interface Chunk {
  id: string;
  repositoryId: string;
  relativePath: string;
  language: string;
  startLine: number;
  endLine: number;
  text: string;
  fileHash: string;
  timestamp: Date;
  namespace?: string;
  className?: string;
  methodName?: string;
  headingPath?: string[];
  symbolKind?: SymbolKind;
  gitCommitHash?: string;
  wikiLinks?: string[];
  // Multi-part document fields (set by splitChunkForEmbedding)
  partIndex?: number;   // 0-based index of this part
  totalParts?: number;  // Total number of parts in the document
}
