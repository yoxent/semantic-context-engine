import type { SymbolKind } from "./SymbolKind.js";

export interface SymbolHit {
  chunkId: string;
  symbolKind: SymbolKind;
  name: string;
  qualifiedName: string;
  relativePath: string;
  matchType: "exact" | "prefix";
}