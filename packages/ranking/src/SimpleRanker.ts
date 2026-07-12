import type { IRanker, SearchHit, SearchQuery } from "@sce/core";

export class SimpleRanker implements IRanker {
  rank(hits: SearchHit[], query: SearchQuery): SearchHit[] {
    const needle = query.text.toLowerCase();
    const ranked = hits.map((hit) => {
      let score = hit.score;
      if (hit.path.toLowerCase().includes(needle)) score += 5;
      if (hit.snippet.toLowerCase().includes(needle)) score += 2;
      if (hit.snippet.toLowerCase().includes(` ${needle} `)) score += 1;
      return { ...hit, score };
    });

    return ranked.sort((a, b) => b.score - a.score).slice(0, query.limit ?? ranked.length);
  }
}
