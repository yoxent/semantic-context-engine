# SCE Hybrid Search Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in hybrid search to SCE that runs the existing keyword and semantic strategies in parallel and fuses their ranked lists with Reciprocal Rank Fusion (RRF, `k = 60`), exposed as `search({ mode: "hybrid" })` / `hybridSearch()` and through CLI `--mode hybrid` and MCP `mode: "hybrid"` — without changing default keyword behavior, touching AST, or adding new config keys.

**Architecture:** Follow existing package boundaries. `@sce/retrieval` owns `HybridRetrievalStrategy`, which implements `IRetrievalStrategy` (`name = "hybrid"`) and depends only on the already-built keyword and semantic strategies plus `defaultLimit`; a private RRF helper lives next to it. `@sce/core` routes `mode: "hybrid"` / `hybridSearch()` to an injected `hybridStrategy` and throws a clear configuration error when hybrid is requested but not wired. `@sce/runtime` constructs `HybridRetrievalStrategy` only when the `embedding` block is present (the same gate that creates the semantic strategy) and injects it into `SemanticContextEngine`. CLI and MCP stay thin adapters that accept the new mode and forward to core/runtime. No new `sce.config.json` keys.

**Tech Stack:** TypeScript, Node.js 20+, npm workspaces, Vitest, `zod`, and the existing `commander` / `@modelcontextprotocol/sdk` adapters. No new dependencies.

## Global Constraints

- Work only on branch `develop`. Do not commit to `main` (production-only).
- Hybrid means **keyword + semantic only**. AST is not part of the fuse in this slice.
- Hybrid requires the same `embedding` config gate as semantic. If hybrid is requested without embedding configured, throw a clear configuration error (do **not** silently fall back to keyword).
- Fusion uses **Reciprocal Rank Fusion** with hardcoded `k = 60`. No weighted linear blend and no user-facing RRF config.
- Each side over-fetches with `candidateLimit = max((limit ?? defaultLimit) * 2, 20)`, then RRF merges, then results are cut to the requested `limit`.
- `pathFilter` and `language` are rejected in hybrid with the same clear unsupported-filter errors used by semantic. `repositoryIds` is honored (forwarded to both sides).
- Fused hits use `strategy: "hybrid"` and `score` equal to the fused RRF score. Do **not** re-run `SimpleRanker` after fusion (each side already ranked itself).
- Keep CLI and MCP as thin adapters over `@sce/runtime`/`@sce/core`; they must not own fusion, ranking, or retrieval logic.
- Pasttime must remain untouched: no imports, shared packages, links, or product coupling. Do not reference Pasttime in code.
- No new `sce.config.json` keys. Hybrid is available whenever the existing `embedding` block enables semantic search.
- Failures from either child strategy propagate; hybrid does not swallow partial failures into a one-sided result.
- Use TDD for each task. Run `npm test`, `npm run typecheck`, and `npm run build` green before each commit. Commit on `develop` after every task.
- Do not start implementation until the plan has been reviewed and you are explicitly asked.

## Non-Goals

- No AST contribution to hybrid.
- No configurable RRF `k`, blend weights, or over-fetch multiplier.
- No silent keyword fallback when embedding is missing.
- No post-filter support for `pathFilter` / `language` in hybrid (reject instead).
- No shared fusion helper in `@sce/ranking` (the RRF helper stays private in `@sce/retrieval` for now).
- No binary vector layout / ANN index changes.
- No cloud-only embedding providers.
- No web UI.
- No Pasttime coupling.
- No PR as part of this slice.

---

## File Structure

Create and modify this structure across the implementation:

```text
packages/retrieval/src/HybridRetrievalStrategy.ts                       # Create
packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts        # Create
packages/retrieval/src/index.ts                                         # Modify: export HybridRetrievalStrategy

packages/core/src/api/SemanticContextEngine.ts                          # Modify: route hybrid + hybridStrategy dep
packages/core/src/api/SemanticContextEngine.test.ts                     # Modify: hybrid routing tests; update ast/hybrid rejection test

packages/runtime/src/createEngine.ts                                    # Modify: wire hybrid when embedding configured
packages/runtime/src/__tests__/createEngine.test.ts                     # Modify: hybrid wiring test

packages/cli/src/main.ts                                                # Modify: accept --mode hybrid
packages/cli/src/__tests__/main.test.ts                                 # Modify: hybrid mode + config-error test

packages/mcp/src/server.ts                                              # Modify: add "hybrid" to sce_search mode enum
packages/mcp/src/tools.ts                                               # Modify: accept mode: "hybrid"
packages/mcp/src/__tests__/tools.test.ts                                # Modify: hybrid config-error test

README.md                                                               # Modify: document hybrid mode
HANDOFF.md                                                              # Modify: mark hybrid shipped + follow-ups

docs/superpowers/specs/2026-07-13-sce-hybrid-search-slice-design.md     # No change (source of truth)
```

Responsibilities:
- `HybridRetrievalStrategy`: validates hybrid filters, computes `candidateLimit`, calls the injected keyword and semantic strategies in parallel with `mode: "keyword"` / `mode: "semantic"` and `limit: candidateLimit`, fuses their `hits` with a private RRF helper (`k = 60`, 1-based ranks), picks one payload per `chunkId` (prefer the side with the larger individual RRF term; tie → keyword), sets `score` to the fused RRF score and `strategy` to `"hybrid"`, sorts by fused score desc then `chunkId` asc, slices to `limit`, and returns `SearchResult` with `strategy: "hybrid"` diagnostics and `scannedChunks` = unique chunk ids across both sides before the final cut. Knows nothing about storage, embeddings, indexes, or ranking internals.
- `SemanticContextEngine`: adds optional `hybridStrategy?: IRetrievalStrategy` to `SemanticContextEngineDeps`; `search({ mode: "hybrid" })` and `hybridSearch()` route to it or throw `Hybrid search is not configured (sce.config.json missing 'embedding' block)`. Keyword default and semantic behavior stay unchanged. `ast` stays unimplemented.
- `createEngine`: when `config.embedding` is present, builds `HybridRetrievalStrategy({ keywordStrategy, semanticStrategy, defaultLimit: config.search.defaultLimit })` and injects it as `hybridStrategy`. When absent, builds the current keyword-only engine unchanged.
- CLI/MCP: accept `mode: "hybrid"` / `--mode hybrid`; default remains `keyword`; pass through to `engine.search`; surface hybrid-not-configured errors clearly.

---

## Task 1: `HybridRetrievalStrategy` with RRF fusion

**Files:**
- Create: `packages/retrieval/src/HybridRetrievalStrategy.ts`
- Create: `packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts`
- Modify: `packages/retrieval/src/index.ts`

**Interfaces:**
- Consumes: `IRetrievalStrategy`, `SearchHit`, `SearchQuery`, `SearchResult` from `@sce/core`. The child strategies are any `IRetrievalStrategy` with `name` `"keyword"` and `"semantic"` respectively; hybrid calls `child.search({ ...query, mode, limit: candidateLimit })` and reads `result.hits` (already ranked).
- Produces: `HybridRetrievalStrategy` constructor `(deps: HybridRetrievalStrategyDeps)` where `HybridRetrievalStrategyDeps = { keywordStrategy: IRetrievalStrategy; semanticStrategy: IRetrievalStrategy; defaultLimit: number }`. `readonly name = "hybrid"`. Later tasks inject this as `hybridStrategy` in core and runtime.

- [ ] **Step 1: Write failing tests for RRF fusion, over-fetch, filter rejection, payload preference, and diagnostics**

Create `packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HybridRetrievalStrategy } from "../HybridRetrievalStrategy.js";
import type { IRetrievalStrategy, SearchHit, SearchQuery } from "@sce/core";

function hit(chunkId: string, strategy: "keyword" | "semantic", path: string): SearchHit {
  return {
    chunkId,
    score: 0,
    strategy,
    snippet: `snippet-${chunkId}`,
    path,
    startLine: 1,
    endLine: 2
  };
}

/** Builds a stub child strategy that records the query it received and returns canned ranked hits. */
function stubStrategy(
  name: "keyword" | "semantic",
  hits: SearchHit[],
  received: SearchQuery[] = []
): IRetrievalStrategy {
  return {
    name,
    search: async (query) => {
      received.push(query);
      return { hits, diagnostics: { strategy: name, scannedChunks: hits.length } };
    }
  };
}

const RRF_K = 60;
const term = (rank: number) => 1 / (RRF_K + rank);

describe("HybridRetrievalStrategy", () => {
  it("rejects pathFilter and language with a clear unsupported-filter error", async () => {
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", []),
      semanticStrategy: stubStrategy("semantic", []),
      defaultLimit: 10
    });
    await expect(strategy.search({ text: "x", pathFilter: "notes/*" })).rejects.toThrow(/pathFilter.*hybrid|hybrid.*pathFilter/i);
    await expect(strategy.search({ text: "x", language: "markdown" })).rejects.toThrow(/language.*hybrid|hybrid.*language/i);
  });

  it("over-fetches each side with max(limit*2, 20) and cuts to the requested limit", async () => {
    const kwReceived: SearchQuery[] = [];
    const semReceived: SearchQuery[] = [];
    const kwHits = ["a", "b", "c", "d", "e"].map((id) => hit(id, "keyword", `k/${id}.md`));
    const semHits = ["f", "g", "h", "i", "j"].map((id) => hit(id, "semantic", `s/${id}.md`));

    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits, kwReceived),
      semanticStrategy: stubStrategy("semantic", semHits, semReceived),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 5 });

    expect(kwReceived[0]?.limit).toBe(20); // max(5*2, 20) = 20
    expect(semReceived[0]?.limit).toBe(20);
    expect(kwReceived[0]?.mode).toBe("keyword");
    expect(semReceived[0]?.mode).toBe("semantic");
    expect(result.hits).toHaveLength(5); // cut to limit
  });

  it("uses defaultLimit when query.limit is omitted (candidateLimit = max(defaultLimit*2, 20))", async () => {
    const kwReceived: SearchQuery[] = [];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", [], kwReceived),
      semanticStrategy: stubStrategy("semantic", []),
      defaultLimit: 15
    });
    await strategy.search({ text: "x" });
    expect(kwReceived[0]?.limit).toBe(30); // max(15*2, 20) = 30
  });

  it("fuses disjoint lists with RRF and boosts chunks present on both sides", async () => {
    // keyword ranks: A(1), B(2), C(3)
    // semantic ranks: D(1), B(2), A(3)
    const kwHits = [hit("A", "keyword", "k/A.md"), hit("B", "keyword", "k/B.md"), hit("C", "keyword", "k/C.md")];
    const semHits = [hit("D", "semantic", "s/D.md"), hit("B", "semantic", "s/B.md"), hit("A", "semantic", "s/A.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });

    const ids = result.hits.map((h) => h.chunkId);
    // A and B appear on both sides and must outrank the single-side hits D and C.
    expect(ids.slice(0, 2).sort()).toEqual(["A", "B"]);
    expect(result.hits[0]?.score).toBeCloseTo(term(1) + term(3), 10); // A: kw rank1 + sem rank3
    // A edges B because 1/61 + 1/63 > 1/62 + 1/62
    expect(result.hits[0]?.chunkId).toBe("A");
    expect(result.hits[1]?.chunkId).toBe("B");
  });

  it("breaks remaining fused-score ties by chunkId ascending", async () => {
    // keyword: X(1), Y(2) ; semantic: Y(1), X(2)
    // X = 1/61 + 1/62 ; Y = 1/62 + 1/61  -> identical fused scores, a perfect tie.
    const kwHits = [hit("X", "keyword", "k/X.md"), hit("Y", "keyword", "k/Y.md")];
    const semHits = [hit("Y", "semantic", "s/Y.md"), hit("X", "semantic", "s/X.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    // Same fused score -> chunkId asc: X before Y
    expect(result.hits.map((h) => h.chunkId)).toEqual(["X", "Y"]);
    expect(result.hits[0]?.score).toBeCloseTo(term(1) + term(2), 10);
    expect(result.hits[1]?.score).toBeCloseTo(term(1) + term(2), 10);
  });

  it("prefers the keyword payload on a per-chunk RRF-term tie", async () => {
    // Both sides rank X at rank 1 -> equal terms -> tie -> keyword payload wins.
    const kwHits = [hit("X", "keyword", "k/X.md")];
    const semHits = [hit("X", "semantic", "s/X.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.path).toBe("k/X.md");
  });

  it("prefers the side with the larger individual RRF term for the same chunk", async () => {
    // keyword: X(1), Y(2) ; semantic: Y(1)
    // For Y: kw term 1/62 < sem term 1/61 -> prefer semantic payload for Y.
    // For X: only keyword -> keyword payload.
    const kwHits = [hit("X", "keyword", "k/X.md"), hit("Y", "keyword", "k/Y.md")];
    const semHits = [hit("Y", "semantic", "s/Y.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    const byId = new Map(result.hits.map((h) => [h.chunkId, h] as const));
    expect(byId.get("X")?.path).toBe("k/X.md");
    expect(byId.get("Y")?.path).toBe("s/Y.md");
  });

  it("marks every fused hit as strategy 'hybrid' with the fused RRF score", async () => {
    const kwHits = [hit("A", "keyword", "k/A.md")];
    const semHits = [hit("A", "semantic", "s/A.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 10 });
    expect(result.hits[0]?.strategy).toBe("hybrid");
    expect(result.hits[0]?.score).toBeCloseTo(term(1) + term(1), 10);
  });

  it("forwards repositoryIds to both child strategies", async () => {
    const kwReceived: SearchQuery[] = [];
    const semReceived: SearchQuery[] = [];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", [], kwReceived),
      semanticStrategy: stubStrategy("semantic", [], semReceived),
      defaultLimit: 10
    });
    await strategy.search({ text: "x", repositoryIds: ["repo-1", "repo-2"] });
    expect(kwReceived[0]?.repositoryIds).toEqual(["repo-1", "repo-2"]);
    expect(semReceived[0]?.repositoryIds).toEqual(["repo-1", "repo-2"]);
  });

  it("reports hybrid diagnostics with elapsedMs and unique scannedChunks before the final cut", async () => {
    // 3 unique chunk ids across both sides (A, B, C), limit 2 -> 2 hits but scannedChunks = 3.
    const kwHits = [hit("A", "keyword", "k/A.md"), hit("B", "keyword", "k/B.md")];
    const semHits = [hit("B", "semantic", "s/B.md"), hit("C", "semantic", "s/C.md")];
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", kwHits),
      semanticStrategy: stubStrategy("semantic", semHits),
      defaultLimit: 10
    });
    const result = await strategy.search({ text: "x", limit: 2 });
    expect(result.diagnostics?.strategy).toBe("hybrid");
    expect(result.diagnostics?.scannedChunks).toBe(3); // unique across both sides, before cut
    expect(typeof result.diagnostics?.elapsedMs).toBe("number");
    expect(result.hits).toHaveLength(2);
  });

  it("propagates failures from a child strategy instead of returning a one-sided result", async () => {
    const failing: IRetrievalStrategy = {
      name: "semantic",
      search: async () => {
        throw new Error("embedding provider down");
      }
    };
    const strategy = new HybridRetrievalStrategy({
      keywordStrategy: stubStrategy("keyword", [hit("A", "keyword", "k/A.md")]),
      semanticStrategy: failing,
      defaultLimit: 10
    });
    await expect(strategy.search({ text: "x" })).rejects.toThrow(/embedding provider down/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts`
Expected: FAIL — module `../HybridRetrievalStrategy.js` not found.

- [ ] **Step 3: Implement the strategy and RRF helper**

Create `packages/retrieval/src/HybridRetrievalStrategy.ts`:

```ts
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
```

Modify `packages/retrieval/src/index.ts`:

```ts
export * from "./KeywordRetrievalStrategy.js";
export * from "./SemanticRetrievalStrategy.js";
export * from "./HybridRetrievalStrategy.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts`
Expected: PASS — all 12 cases.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green. Existing keyword/semantic tests unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/retrieval/src/HybridRetrievalStrategy.ts packages/retrieval/src/__tests__/HybridRetrievalStrategy.test.ts packages/retrieval/src/index.ts
git commit -m "feat(retrieval): add HybridRetrievalStrategy with RRF fusion"
```

---

## Task 2: Core routing for hybrid mode

**Files:**
- Modify: `packages/core/src/api/SemanticContextEngine.ts`
- Modify: `packages/core/src/api/SemanticContextEngine.test.ts`

**Interfaces:**
- Consumes: `IRetrievalStrategy` from `../interfaces/RetrievalStrategy.js`; `SearchMode`, `SearchQuery`, `SearchResult` from `../models/Search.js`.
- Produces: `SemanticContextEngineDeps` gains optional `hybridStrategy?: IRetrievalStrategy`. `search({ mode: "hybrid" })` and `hybridSearch(query)` route to it with `mode: "hybrid"`, or throw `Hybrid search is not configured (sce.config.json missing 'embedding' block)` when absent. Runtime (Task 3) injects the strategy from Task 1.

- [ ] **Step 1: Write failing tests for hybrid routing**

Append to `packages/core/src/api/SemanticContextEngine.test.ts` (after the `describe("SemanticContextEngine semantic routing", ...)` block):

```ts
describe("SemanticContextEngine hybrid routing", () => {
  it("throws a clear error when hybrid is requested but not configured", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({
      keywordStrategy: keyword,
      semanticStrategy: { name: "semantic", search: async () => ({ hits: [] }) }
    });
    await expect(engine.search({ text: "architecture", mode: "hybrid" })).rejects.toThrow(
      /Hybrid search is not configured/
    );
    await expect(engine.hybridSearch({ text: "architecture" })).rejects.toThrow(/Hybrid search is not configured/);
  });

  it("routes hybrid mode to the hybrid strategy when configured", async () => {
    const calls: SearchQuery[] = [];
    const hybrid: IRetrievalStrategy = {
      name: "hybrid",
      search: async (query) => {
        calls.push(query);
        return {
          hits: [{ chunkId: "h1", score: 0.03, strategy: "hybrid", snippet: "fused", path: "H.md", startLine: 1, endLine: 3 }],
          diagnostics: { strategy: "hybrid" }
        };
      }
    };
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: { name: "semantic", search: async () => ({ hits: [] }) },
      hybridStrategy: hybrid
    });

    const result = await engine.search({ text: "cards flip", mode: "hybrid" });
    expect(result.hits[0]?.chunkId).toBe("h1");
    expect(calls[0]?.mode).toBe("hybrid");
  });

  it("hybridSearch() delegates to the hybrid strategy with mode 'hybrid'", async () => {
    const calls: SearchQuery[] = [];
    const engine = new SemanticContextEngine({
      keywordStrategy: { name: "keyword", search: async () => ({ hits: [] }) },
      semanticStrategy: { name: "semantic", search: async () => ({ hits: [] }) },
      hybridStrategy: {
        name: "hybrid",
        search: async (query) => {
          calls.push(query);
          return { hits: [], diagnostics: { strategy: "hybrid" } };
        }
      }
    });
    const result = await engine.hybridSearch({ text: "inventory" });
    expect(result.diagnostics?.strategy).toBe("hybrid");
    expect(calls[0]?.mode).toBe("hybrid");
  });
});
```

Also update the existing ast/hybrid rejection test so it no longer asserts hybrid is unimplemented. In the existing `it("rejects ast and hybrid modes as unimplemented", ...)` block, replace the hybrid assertion so only `ast` remains unimplemented and hybrid now reports its configuration error. Change:

```ts
  it("rejects ast and hybrid modes as unimplemented", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    await expect(engine.search({ text: "x", mode: "ast" })).rejects.toThrow(/Search mode ast is not implemented in v1/);
    await expect(engine.search({ text: "x", mode: "hybrid" })).rejects.toThrow(/Search mode hybrid is not implemented in v1/);
  });
```

to:

```ts
  it("rejects ast as unimplemented and hybrid as not-configured when no hybrid strategy is wired", async () => {
    const keyword: IRetrievalStrategy = { name: "keyword", search: async () => ({ hits: [] }) };
    const engine = new SemanticContextEngine({ keywordStrategy: keyword });
    await expect(engine.search({ text: "x", mode: "ast" })).rejects.toThrow(/Search mode ast is not implemented in v1/);
    await expect(engine.search({ text: "x", mode: "hybrid" })).rejects.toThrow(/Hybrid search is not configured/);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: FAIL — `engine.search({ mode: "hybrid" })` still throws `Search mode hybrid is not implemented in v1`, and `hybridSearch` is unsupported.

- [ ] **Step 3: Wire hybrid routing into the engine**

Modify `packages/core/src/api/SemanticContextEngine.ts`.

Add `hybridStrategy?: IRetrievalStrategy;` to `SemanticContextEngineDeps`:

```ts
export interface SemanticContextEngineDeps {
  keywordStrategy: IRetrievalStrategy;
  semanticStrategy?: IRetrievalStrategy;
  hybridStrategy?: IRetrievalStrategy;
  indexingService?: IIndexingService;
  metadataStore?: IMetadataStore;
  logger?: Logger;
}
```

Update `search` to route hybrid, and replace the `hybridSearch` body. The updated methods:

```ts
  async search(query: SearchQuery): Promise<SearchResult> {
    const mode = query.mode ?? "keyword";
    if (mode === "keyword") return this.keywordSearch(query);
    if (mode === "semantic") return this.semanticSearch(query);
    if (mode === "hybrid") return this.hybridSearch(query);
    return this.unsupported(mode, query);
  }
```

```ts
  async hybridSearch(query: SearchQuery): Promise<SearchResult> {
    if (!this.deps.hybridStrategy) {
      throw new Error("Hybrid search is not configured (sce.config.json missing 'embedding' block)");
    }
    return this.deps.hybridStrategy.search({ ...query, mode: "hybrid" });
  }
```

Leave `keywordSearch`, `semanticSearch`, `astSearch`, and `unsupported` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/api/SemanticContextEngine.test.ts`
Expected: PASS — all existing + new hybrid routing cases green; ast still rejected.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/api/SemanticContextEngine.ts packages/core/src/api/SemanticContextEngine.test.ts
git commit -m "feat(core): route hybrid search to an injected hybridStrategy"
```

---

## Task 3: Runtime wires hybrid when embedding is configured

**Files:**
- Modify: `packages/runtime/src/createEngine.ts`
- Modify: `packages/runtime/src/__tests__/createEngine.test.ts`

**Interfaces:**
- Consumes: `HybridRetrievalStrategy` from `@sce/retrieval` (Task 1); the already-built `keywordStrategy` and `semanticStrategy`; `config.search.defaultLimit`.
- Produces: `createEngine` injects `hybridStrategy` into `SemanticContextEngine` whenever `config.embedding` is present. When absent, the engine is keyword-only and `engine.hybridSearch(...)` throws `Hybrid search is not configured`.

- [ ] **Step 1: Write a failing test for hybrid wiring**

Append to `packages/runtime/src/__tests__/createEngine.test.ts` (after the `describe("createEngine semantic wiring", ...)` block):

```ts
describe("createEngine hybrid wiring", () => {
  it("does not wire hybrid when embedding is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-hyb-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      await expect(created.engine.hybridSearch({ text: "SQLite" })).rejects.toThrow(/Hybrid search is not configured/);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("wires hybrid strategy when embedding block is present (routes without the not-configured error)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-hyb-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          embedding: {
            provider: "openai-compatible",
            baseUrl: "http://localhost:11434/v1",
            model: "nomic-embed-text",
            dimensions: 4
          }
        })
      );
      const created = await createEngine(dir);
      close = created.close;
      // Hybrid is wired, so the call must not throw the not-configured error.
      // With no real embedding server, the semantic side will fail during the
      // embed call; we assert routing wires by matching the embedding failure
      // rather than the configuration error.
      await expect(created.engine.hybridSearch({ text: "vectors" })).rejects.toThrow(
        /Embedding provider|fetch|HTTP/
      );
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: FAIL — the embedding-present case throws `Hybrid search is not configured` because no `hybridStrategy` is wired yet.

- [ ] **Step 3: Build and inject `HybridRetrievalStrategy`**

Modify `packages/runtime/src/createEngine.ts`.

Update the retrieval import to include `HybridRetrievalStrategy`:

```ts
import { HybridRetrievalStrategy, KeywordRetrievalStrategy, SemanticRetrievalStrategy } from "@sce/retrieval";
```

After the `semanticStrategy` declaration (and before `indexingService`), add the hybrid strategy, built only when the semantic strategy exists:

```ts
  const hybridStrategy =
    semanticStrategy
      ? new HybridRetrievalStrategy({
          keywordStrategy,
          semanticStrategy,
          defaultLimit: config.search.defaultLimit
        })
      : undefined;
```

Then pass it into the engine deps alongside `semanticStrategy`:

```ts
    engine: new SemanticContextEngine({
      keywordStrategy,
      ...(semanticStrategy ? { semanticStrategy } : {}),
      ...(hybridStrategy ? { hybridStrategy } : {}),
      indexingService,
      metadataStore: storage,
      logger: logger.child({ component: "engine" })
    }),
```

Leave everything else unchanged. `vectorStore`, `embeddingProvider`, `embeddingConfig`, and `indexingService` construction stay as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/runtime/src/__tests__/createEngine.test.ts`
Expected: PASS — hybrid absent case throws not-configured; hybrid present case reaches the embedding call (fetch failure) instead.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/createEngine.ts packages/runtime/src/__tests__/createEngine.test.ts
git commit -m "feat(runtime): wire HybridRetrievalStrategy when embedding is configured"
```

---

## Task 4: CLI `--mode hybrid`

**Files:**
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/__tests__/main.test.ts`

**Interfaces:**
- Consumes: `engine.search` from `@sce/runtime`; `SearchMode` values `"keyword" | "semantic" | "hybrid"`.
- Produces: `sce search --mode hybrid` forwards `mode: "hybrid"` to `engine.search`. Default remains `keyword`. Hybrid-not-configured errors surface on stderr via the existing `console.error` handler.

- [ ] **Step 1: Write failing tests for CLI hybrid mode**

Append to `packages/cli/src/__tests__/main.test.ts` (inside the top-level `describe("CLI run", ...)` block, after the semantic-not-configured test):

```ts
  it("surfaces a clear error for --mode hybrid when embedding is not configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-cli-hyb-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await run(["search", "vectors", "--path", dir, "--mode", "hybrid"]);
      expect(err).toHaveBeenCalledWith(expect.stringMatching(/Hybrid search is not configured/));
    } finally {
      await rmWithRetry(dir);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/cli/src/__tests__/main.test.ts`
Expected: FAIL — `--mode hybrid` is currently coerced to `"keyword"` (the existing code maps anything other than `"semantic"` to `"keyword"`), so the not-configured error never fires.

- [ ] **Step 3: Accept hybrid in the CLI search action**

Modify `packages/cli/src/main.ts` in the `search` command action. Replace the mode-coercion line:

```ts
        const mode = options.mode === "semantic" ? "semantic" : "keyword";
```

with a typed acceptance of all three modes:

```ts
        const mode: "keyword" | "semantic" | "hybrid" =
          options.mode === "semantic" || options.mode === "hybrid" ? options.mode : "keyword";
```

Leave the rest of the action (search call, hit mapping, JSON/text printing, `truncate`) unchanged. The existing `catch` already surfaces `error.message` via `console.error`, so the hybrid-not-configured error surfaces without further changes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/cli/src/__tests__/main.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/main.ts packages/cli/src/__tests__/main.test.ts
git commit -m "feat(cli): accept --mode hybrid and surface config errors"
```

---

## Task 5: MCP `sce_search` accepts `mode: "hybrid"`

**Files:**
- Modify: `packages/mcp/src/server.ts`
- Modify: `packages/mcp/src/tools.ts`
- Modify: `packages/mcp/src/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `engine.search` from `@sce/runtime`.
- Produces: `sce_search` tool schema accepts `mode: "keyword" | "semantic" | "hybrid"`; `sceSearch` forwards it to `engine.search`. Hybrid-not-configured errors propagate to the MCP caller.

- [ ] **Step 1: Write a failing test for MCP hybrid config error**

Append to `packages/mcp/src/__tests__/tools.test.ts` (after the semantic-not-configured test):

```ts
  it("surfaces hybrid-not-configured when mode=hybrid and embedding is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-mcp-hyb-"));
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await expect(sceSearch({ path: dir, query: "vectors", mode: "hybrid" })).rejects.toThrow(
        /Hybrid search is not configured/
      );
    } finally {
      await rmWithRetry(dir);
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/mcp/src/__tests__/tools.test.ts`
Expected: FAIL — the MCP schema rejects `"hybrid"` (zod enum currently allows only `keyword` / `semantic`), and `sceSearch` types don't include `"hybrid"`.

- [ ] **Step 3: Accept hybrid in the MCP schema and handler**

Modify `packages/mcp/src/server.ts` — update the `sce_search` tool `mode` field enum:

```ts
    mode: z.enum(["keyword", "semantic", "hybrid"]).optional(),
```

Modify `packages/mcp/src/tools.ts` — widen the `sceSearch` input `mode` type and the value forwarded to `engine.search`. Replace the input type:

```ts
export async function sceSearch(input: {
  path: string;
  query: string;
  mode?: "keyword" | "semantic";
  limit?: number;
  includeText?: boolean;
  pathFilter?: string;
  language?: string;
  repositoryIds?: string[];
}) {
```

with:

```ts
export async function sceSearch(input: {
  path: string;
  query: string;
  mode?: "keyword" | "semantic" | "hybrid";
  limit?: number;
  includeText?: boolean;
  pathFilter?: string;
  language?: string;
  repositoryIds?: string[];
}) {
```

The existing `mode: input.mode ?? "keyword"` line inside the `engine.search` call already forwards any of the three values correctly; leave it unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/mcp/src/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/src/tools.ts packages/mcp/src/__tests__/tools.test.ts
git commit -m "feat(mcp): accept mode 'hybrid' in sce_search"
```

---

## Task 6: Document hybrid search in README and HANDOFF

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: the shipped behavior from Tasks 1–5 and the approved design doc.
- Produces: README documents hybrid as opt-in (requires `embedding`), RRF fusion, over-fetch behavior, and filter limitations; HANDOFF marks hybrid shipped and keeps the remaining follow-ups.

- [ ] **Step 1: Update the README intro and package role line**

Modify `README.md`:

In the opening paragraph (line 3), replace:

```md
Local-first retrieval for AI coding agents. SCE indexes a Markdown knowledge vault (or later a code repo), then returns concise keyword and opt-in semantic hits through a shared core API exposed as CLI and MCP.
```

with:

```md
Local-first retrieval for AI coding agents. SCE indexes a Markdown knowledge vault (or later a code repo), then returns concise keyword, opt-in semantic, and opt-in hybrid hits through a shared core API exposed as CLI and MCP.
```

On line 5, replace:

```md
SCE is **not** a vector database. Keyword and opt-in semantic search ship on `develop`; AST, hybrid, binary vectors, and ANN indexing stay behind interfaces for later slices.
```

with:

```md
SCE is **not** a vector database. Keyword, opt-in semantic, and opt-in hybrid search ship on `develop`; AST, binary vectors, and ANN indexing stay behind interfaces for later slices.
```

In the MCP tools table, replace:

```md
| `sce_search` | Keyword or semantic search (`mode`, `limit`, `includeText`, `pathFilter`, `language`, `repositoryIds`) |
```

with:

```md
| `sce_search` | Keyword, semantic, or hybrid search (`mode`, `limit`, `includeText`, `pathFilter`, `language`, `repositoryIds`) |
```

In the Packages table, replace:

```md
| `@sce/retrieval` | Keyword and semantic retrieval strategies |
```

with:

```md
| `@sce/retrieval` | Keyword, semantic, and hybrid retrieval strategies |
```

- [ ] **Step 2: Add a "Hybrid search (opt-in)" section to the README**

Modify `README.md` — immediately after the semantic-mode `### Future work` subsection (which ends just before `## Packages`), insert a new hybrid section. Insert this block between the semantic `### Future work` block and the `## Packages` heading:

````md
## Hybrid search (opt-in)

Hybrid search runs the keyword and semantic strategies in parallel and fuses their ranked lists with **Reciprocal Rank Fusion** (`k = 60`). It is available whenever semantic search is enabled (i.e. when the `embedding` block is present in `sce.config.json`). There are no extra config keys.

Request hybrid mode explicitly:

```bash
sce search "how is inventory persisted" --path ./fixtures/sample-vault --mode hybrid
```

MCP `sce_search` accepts `mode: "hybrid"`.

Behavior:

- Each side over-fetches `max(limit * 2, 20)` candidates, RRF merges the two ranked lists, then results are cut to the requested `limit`.
- A chunk that appears on **both** sides gets a higher fused score than a chunk on one side — that boost is the hybrid signal.
- Each fused hit reports `strategy: "hybrid"` and a `score` equal to the fused RRF score. SCE does **not** re-rank fused hits with `SimpleRanker`; each side already ranked itself.
- Hybrid honors `repositoryIds` (forwarded to both sides). `pathFilter` and `language` remain keyword-only and throw a clear unsupported-filter error when used with `--mode hybrid`.
- If hybrid is requested without an `embedding` block, SCE throws `Hybrid search is not configured` rather than silently falling back to keyword.
````

- [ ] **Step 3: Update the README non-goals and future-work line**

Modify `README.md` — in the semantic `### Future work` block, replace:

```md
The future goal is a separate `.sce/semantic/` layout (`embeddings.bin`, `vector.index`) behind the same `IVectorStore` interface, plus hybrid, AST, ANN indexing, and cloud-only providers as later slices.
```

with:

```md
The future goal is a separate `.sce/semantic/` layout (`embeddings.bin`, `vector.index`) behind the same `IVectorStore` interface, plus AST, ANN indexing, and cloud-only providers as later slices.
```

In the `## Explicit non-goals (v1)` list, replace:

```md
- Hybrid / AST search
```

with:

```md
- AST search
```

- [ ] **Step 4: Add the hybrid docs entry to the README Docs list**

Modify `README.md` — in the `## Docs` list, after the semantic slice plan line:

```md
- `docs/superpowers/plans/2026-07-13-sce-semantic-search-slice.md` — semantic slice implementation plan
```

add:

```md
- `docs/superpowers/specs/2026-07-13-sce-hybrid-search-slice-design.md` — approved hybrid slice design
- `docs/superpowers/plans/2026-07-13-sce-hybrid-search-slice.md` — hybrid slice implementation plan
```

- [ ] **Step 5: Mark hybrid shipped in HANDOFF.md**

Modify `HANDOFF.md`.

In the `## Current state (2026-07-13)` intro line, replace:

```md
First interface-first vertical, ops polish, ranking, and the opt-in semantic search slice are implemented on **`develop`**.
```

with:

```md
First interface-first vertical, ops polish, ranking, the opt-in semantic search slice, and the opt-in hybrid search slice are implemented on **`develop`**.
```

In `## Canonical docs`, after the semantic slice plan line:

```md
- `docs/superpowers/plans/2026-07-13-sce-semantic-search-slice.md` — semantic slice implementation plan
```

add:

```md
- `docs/superpowers/specs/2026-07-13-sce-hybrid-search-slice-design.md` — approved hybrid slice design
- `docs/superpowers/plans/2026-07-13-sce-hybrid-search-slice.md` — hybrid slice implementation plan
```

In `## Known follow-ups`, replace:

```md
- Hybrid search that combines keyword and semantic scores
- AST search strategies
```

with:

```md
- AST search strategies
```

After the `### Shipped (semantic slice, 2026-07-13)` block (the last shipped subsection), append a new shipped subsection:

```md
### Shipped (hybrid slice, 2026-07-13)

- `@sce/retrieval` `HybridRetrievalStrategy` — runs keyword + semantic in parallel, fuses with Reciprocal Rank Fusion (`k = 60`)
- Over-fetch per side `max((limit ?? defaultLimit) * 2, 20)`, then cut to `limit`; `scannedChunks` reports unique chunk ids before the cut
- Fused hits carry `strategy: "hybrid"` and RRF score; no re-ranking after fuse
- `@sce/core` routes `search({ mode: "hybrid" })` / `hybridSearch()` to an injected `hybridStrategy`; clear `Hybrid search is not configured` error when embedding is missing
- `@sce/runtime` wires `HybridRetrievalStrategy` whenever the `embedding` block is present
- CLI `--mode hybrid`; MCP `sce_search` `mode: "hybrid"`
- Hybrid honors `repositoryIds`; rejects `pathFilter` / `language` with the same unsupported-filter errors as semantic
- No new `sce.config.json` keys; AST fusion, configurable RRF `k`, and post-filtering remain follow-ups
```

- [ ] **Step 6: Run full typecheck + build + test**

Run: `npm run typecheck && npm run build && npm test`
Expected: green (docs-only changes; no code touched, but confirm nothing regressed).

- [ ] **Step 7: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "docs: document hybrid search slice as shipped"
```

---

## Verification (final)

After Task 6, run the full verification suite one more time and confirm the baseline holds plus the new behavior:

- [ ] **Run:** `npm run typecheck && npm run build && npm test`
  Expected: typecheck clean, build clean, all tests green (semantic slice baseline `80` plus the new hybrid cases across retrieval, core, runtime, cli, and mcp).
- [ ] **Confirm no `main` commits:** `git log --oneline origin/main..develop` should list the hybrid commits on `develop` only.
- [ ] **Confirm Pasttime untouched:** no new imports, links, or references to Pasttime in any package.
- [ ] **Do not push** unless the user explicitly asks. **Do not open a PR** unless the user explicitly asks.
