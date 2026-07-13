import type { IRetrievalStrategy, SearchHit, SearchQuery, SearchResult } from "@sce/core";

export interface HybridRetrievalStrategyDeps {
  keywordStrategy: IRetrievalStrategy;
  semanticStrategy: IRetrievalStrategy;
  defaultLimit: number;
}

const RRF_K = 60;

export class HybridRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "hybrid" as const;

  constructor(private readonly deps: HybridRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    if (query.pathFilter !== undefined) {
      throw new Error("pathFilter is not supported in hybrid mode");
    }
    if (query.language !== undefined) {
      throw new Error("language is not supported in hybrid mode");
    }

    const start = performance.now();
    const limit = query.limit ?? this.deps.defaultLimit;
    const candidateLimit = Math.max(limit * 2, 20);

    const childQuery: SearchQuery = { ...query, limit: candidateLimit };

    const [keywordResult, semanticResult] = await Promise.all([
      this.deps.keywordStrategy.search({ ...childQuery, mode: "keyword" }),
      this.deps.semanticStrategy.search({ ...childQuery, mode: "semantic" })
    ]);

    const keywordHits = keywordResult.hits;
    const semanticHits = semanticResult.hits;

    const uniqueChunkIds = new Set<string>([
      ...keywordHits.map((h) => h.chunkId),
      ...semanticHits.map((h) => h.chunkId)
    ]);

    const fused = fuseRrf(keywordHits, semanticHits).slice(0, limit);

    return {
      hits: fused,
      diagnostics: {
        strategy: "hybrid",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: uniqueChunkIds.size
      }
    };
  }
}

/**
 * Reciprocal Rank Fusion (k = 60, 1-based ranks).
 *
 * For each chunkId, keeps one hit payload:
 * - prefers the side with the larger individual RRF term for that chunk;
 * - on a tie, prefers the keyword hit (deterministic).
 * Sets score = fused RRF score and strategy = "hybrid".
 * Sorts by fused score descending, then chunkId ascending.
 */
function fuseRrf(keywordHits: SearchHit[], semanticHits: SearchHit[]): SearchHit[] {
  const kwTerms = rrfTerms(keywordHits);
  const semTerms = rrfTerms(semanticHits);
  const kwByChunk = new Map<string, SearchHit>(keywordHits.map((h) => [h.chunkId, h] as const));
  const semByChunk = new Map<string, SearchHit>(semanticHits.map((h) => [h.chunkId, h] as const));

  const chunkIds = new Set<string>([...kwTerms.keys(), ...semTerms.keys()]);

  const fused: SearchHit[] = [];
  for (const chunkId of chunkIds) {
    const kwTerm = kwTerms.get(chunkId) ?? 0;
    const semTerm = semTerms.get(chunkId) ?? 0;
    const score = kwTerm + semTerm;

    // Prefer the side with the larger individual RRF term; tie -> keyword.
    const base = kwTerm >= semTerm ? kwByChunk.get(chunkId) : semByChunk.get(chunkId);
    if (!base) continue; // defensive: should not happen because a term implies a payload

    fused.push({ ...base, score, strategy: "hybrid" });
  }

  fused.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.chunkId < b.chunkId) return -1;
    if (a.chunkId > b.chunkId) return 1;
    return 0;
  });
  return fused;
}

function rrfTerms(hits: SearchHit[]): Map<string, number> {
  const terms = new Map<string, number>();
  hits.forEach((hit, index) => {
    const rank = index + 1; // 1-based
    terms.set(hit.chunkId, 1 / (RRF_K + rank));
  });
  return terms;
}
