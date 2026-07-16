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
}
