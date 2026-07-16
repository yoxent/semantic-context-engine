import type { SearchHit, SearchQuery } from "../models/Search.js";

export interface IRanker {
  rank(hits: SearchHit[], query: SearchQuery): SearchHit[];
}
