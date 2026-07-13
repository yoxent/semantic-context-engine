# SCE Hybrid Search Slice Design

Date: 2026-07-13
Status: Approved for planning
Branch target: `develop`

## Purpose

Add the next interface-first retrieval slice for Semantic Context Engine: opt-in hybrid search that runs keyword and semantic retrieval together and fuses their ranked lists with Reciprocal Rank Fusion (RRF). Keyword remains the default. Semantic remains available as its own mode. This slice should give AI coding agents a working `hybrid` mode without introducing AST fusion, configurable blend weights, a web UI, new storage formats, or Pasttime coupling.

## Locked Decisions

- Hybrid means **keyword + semantic only**. AST is not part of the fuse in this slice; it can join later when AST search ships.
- Hybrid requires the same `embedding` config gate as semantic. If hybrid is requested without embedding configured, throw a clear configuration error (do not silently fall back to keyword).
- Fusion uses **Reciprocal Rank Fusion** with hardcoded `k = 60`. No weighted linear blend and no user-facing RRF config in this slice.
- Each side over-fetches with `candidateLimit = max((limit ?? defaultLimit) * 2, 20)`, then RRF merges, then results are cut to the requested `limit`.
- `pathFilter` and `language` are rejected in hybrid with the same clear unsupported-filter errors used by semantic. `repositoryIds` is honored (forwarded to both sides).
- Hybrid lives as `HybridRetrievalStrategy` in `@sce/retrieval`, depending on the existing keyword and semantic strategies. Core only routes; runtime wires hybrid when embedding is present.
- Fused hits use `strategy: "hybrid"` and `score` equal to the RRF score. Do not re-run `SimpleRanker` after fusion (each side already ranked itself).
- Pasttime remains untouched in code: no imports, shared packages, links, or product coupling.
- Work lands on `develop` only. `main` stays production-only. No PR required as part of this slice.

## Non-Goals

- No AST contribution to hybrid.
- No configurable RRF `k`, blend weights, or over-fetch multiplier.
- No silent keyword fallback when embedding is missing.
- No post-filter support for `pathFilter` / `language` in hybrid (reject instead).
- No binary vector layout / ANN index changes.
- No cloud-only embedding providers.
- No web UI.
- No Pasttime coupling.
- No broad GOAL.md implementation beyond this slice.

## Architecture

The design follows existing package boundaries.

`@sce/retrieval` owns `HybridRetrievalStrategy`, which implements `IRetrievalStrategy` with `name = "hybrid"`. It receives the already-built keyword and semantic strategies plus `defaultLimit`. It does not talk to storage, embeddings, or indexes directly.

`@sce/core` routes `search({ mode: "hybrid" })` and `hybridSearch()` to an injected `hybridStrategy`. If hybrid is requested and no hybrid strategy is wired, throw a clear configuration error in the same family as semantic (`Hybrid search is not configured` / embedding-block guidance). Keyword default and semantic mode behavior stay unchanged. `ast` remains unimplemented.

`@sce/runtime` constructs `HybridRetrievalStrategy` only when the `embedding` block is present (the same condition that creates `SemanticRetrievalStrategy`), and passes it into `SemanticContextEngine`.

`@sce/cli` and `@sce/mcp` remain thin adapters: accept `mode: "hybrid"` / `--mode hybrid` and forward to core/runtime.

`@sce/ranking` is not extended in this slice. A private RRF helper may live next to the hybrid strategy inside `@sce/retrieval`. If a later AST-aware hybrid needs shared fusion, that helper can move to `@sce/ranking` then.

## Hybrid Search Flow

For `hybridSearch(query)` or `search({ ...query, mode: "hybrid" })`:

1. Validate hybrid is configured (hybrid strategy present).
2. Reject `pathFilter` and `language` if present.
3. Resolve `limit = query.limit ?? defaultLimit`.
4. Compute `candidateLimit = max(limit * 2, 20)`.
5. In parallel, call:
   - `keywordStrategy.search({ ...query, mode: "keyword", limit: candidateLimit })`
   - `semanticStrategy.search({ ...query, mode: "semantic", limit: candidateLimit })`
6. Fuse the two hit lists with RRF (`k = 60`, 1-based ranks).
7. For each `chunkId`, keep one hit payload:
   - Prefer the side with the larger individual RRF term for that chunk.
   - If those terms tie, prefer the keyword hit (deterministic).
   - Set `score` to the fused RRF score and `strategy` to `"hybrid"`.
8. Sort by fused score descending; break remaining ties by `chunkId` ascending.
9. Slice to `limit`.
10. Return `SearchResult` with diagnostics:
    - `strategy: "hybrid"`
    - `elapsedMs`: wall time for the whole hybrid call
    - `scannedChunks`: number of unique `chunkId`s seen across both sides before the final cut

## RRF Details

For each ranked list \(L_i\) and each hit at 1-based rank \(r\):

\[
\text{RRF}(chunkId) = \sum_i \frac{1}{k + r_i(chunkId)}
\]

where \(k = 60\). Chunks missing from a list contribute nothing from that list. Presence on both lists boosts the fused score, which is the intended hybrid signal.

## Error Handling

- Missing embedding / hybrid wiring: throw a clear configuration error (do not fall back to keyword).
- Unsupported `pathFilter` / `language`: throw clear unsupported-filter errors.
- Unsupported `ast` mode: unchanged (`not implemented in v1`).
- Failures from either child strategy propagate; hybrid does not swallow partial failures into a one-sided result.

## CLI And MCP Surface

- CLI `search --mode hybrid`
- MCP `sce_search` accepts `mode: "hybrid"`
- Default CLI/MCP search remains keyword
- If hybrid is requested without embedding configured, adapters surface the core error clearly

## Configuration

No new `sce.config.json` keys. Hybrid is available whenever the existing `embedding` block enables semantic search.

## Testing Plan

Unit tests:

- RRF: union of disjoint lists, boost when both sides hit the same chunk, stable tie-break by `chunkId`, payload preference rules.
- Over-fetch: child strategies receive `max(limit * 2, 20)`; final hit count respects `limit` / `defaultLimit`.
- Filter rejection for `pathFilter` and `language`.
- Core routing: hybrid configured vs missing; keyword/semantic paths unchanged; `ast` still rejected.

Integration-style tests:

- Runtime wires hybrid when embedding is configured.
- CLI/MCP hybrid mode routes through shared core behavior and surfaces config errors.

Existing keyword, semantic, ranking, indexing, CLI, and MCP tests must continue to pass.

## Documentation

- README: document hybrid as opt-in (requires embedding), RRF fusion, over-fetch behavior, filter limitations.
- HANDOFF: mark hybrid shipped; keep AST / binary vectors / ANN / cloud providers / UI as follow-ups.

## Future Work

- Add AST as a third RRF list when AST search ships.
- Optional config for `k`, over-fetch multiplier, or weighted fusion if real usage needs it.
- Shared fusion helper in `@sce/ranking` if multiple hybrid variants appear.
- Post-filtering `pathFilter` / `language` across both sides if agents need filtered hybrid.
