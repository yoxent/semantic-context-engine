import type {
  IMetadataStore,
  ISymbolIndex,
  IRetrievalStrategy,
  SearchHit,
  SearchQuery,
  SearchResult,
  SymbolHit
} from "@sce/core";

export interface AstRetrievalStrategyDeps {
  symbolIndex: ISymbolIndex;
  metadataStore: IMetadataStore;
  defaultLimit: number;
  maxSnippetChars: number;
}

export class AstRetrievalStrategy implements IRetrievalStrategy {
  readonly name = "ast" as const;

  constructor(private readonly deps: AstRetrievalStrategyDeps) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    if (!query.text || query.text.trim().length === 0) {
      throw new Error("AST search requires a non-empty symbol name");
    }

    const start = performance.now();
    const limit = query.limit ?? this.deps.defaultLimit;

    const symbolHits = await this.deps.symbolIndex.searchSymbols({
      name: query.text,
      ...(query.symbolKind ? { symbolKind: query.symbolKind } : {}),
      ...(query.repositoryIds ? { repositoryIds: query.repositoryIds } : {}),
      ...(query.pathFilter ? { pathFilter: query.pathFilter } : {}),
      ...(query.language ? { language: query.language } : {}),
      limit
    });

    if (symbolHits.length === 0) {
      return { hits: [], diagnostics: { strategy: "ast", elapsedMs: Math.round(performance.now() - start), scannedChunks: 0 } };
    }

    const chunks = await this.deps.metadataStore.getChunks(symbolHits.map((h) => h.chunkId));
    const byId = new Map(chunks.map((c) => [c.id, c] as const));

    const hits: SearchHit[] = [];
    for (const sh of symbolHits) {
      const chunk = byId.get(sh.chunkId);
      if (!chunk) continue; // defensive: drop missing chunks
      hits.push({
        chunkId: chunk.id,
        score: scoreFromMatchType(sh, query.text),
        strategy: "ast",
        snippet: truncate(chunk.text, this.deps.maxSnippetChars),
        path: chunk.relativePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        ...(chunk.headingPath && chunk.headingPath.length > 0 ? { headingPath: chunk.headingPath } : {}),
        symbolKind: sh.symbolKind
      });
    }

    // symbolHits already came back in ranking order from SQL; preserve it.
    const sliced = hits.slice(0, limit);

    return {
      hits: sliced,
      diagnostics: {
        strategy: "ast",
        elapsedMs: Math.round(performance.now() - start),
        scannedChunks: new Set(symbolHits.map((h) => h.chunkId)).size
      }
    };
  }
}

function scoreFromMatchType(hit: SymbolHit, queryText: string): number {
  if (hit.matchType === "exact") return 1.0;
  const matchedLength = queryText.length;
  const nameLength = hit.name.length;
  if (nameLength === 0) return 0.5;
  return 0.5 + matchedLength / nameLength;
}

function truncate(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const limit = Math.max(0, maxChars);
  if (flat.length <= limit) return flat;
  if (limit <= 3) return flat.slice(0, limit);
  return `${flat.slice(0, limit - 3)}...`;
}
