import type { SearchQuery, SearchResult, SearchMode } from "../models/Search.js";

export interface IRetrievalStrategy {
  name: SearchMode;
  search(query: SearchQuery): Promise<SearchResult>;
}
