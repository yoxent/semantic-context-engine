import type { SymbolKind } from "./SymbolKind.js";

export interface SymbolSearchQuery {
  name: string;
  symbolKind?: SymbolKind;
  repositoryIds?: string[];
  pathFilter?: string;
  language?: string;
  limit: number;
}