# HANDOFF — Add Knowledge Topics in the Boids Vein (next session)

**Prepared**: 2026-08-05 · **Updated**: 2026-08-14 · **Branch**: `develop` · **Do not push** (commit only)

## TL;DR

Add hand-written knowledge topics to the Semantic Context Engine in the same vein as the just-added `boids` topic (emergent / distributed behavioral models, game AI). Follow the exact per-topic pipeline below: **index → export → import → verify → update 3 docs → commit**. One topic at a time, confirm scope with the user before each.

## Read first

- `AGENTS.md` (root) — project guide → points to `HANDOFF.md`, `GOAL.md`, `knowledge/INVENTORY.md`
- `HANDOFF.md` — live state & conventions
- `knowledge/boids/` — the reference topic just added (3 files, 35 chunks): copy its config and structure

## Current state (2026-08-14)

- **D1**: 10,142 chunks / 5,903 vectors (2048-dim, `nvidia/llama-nemotron-embed-vl-1b-v2:free`)
- **Live**: frontend https://sce-web.pasttime.xyz/ · API https://sce-api.pasttime.xyz
- **Done recently**: Batch 55 (71c) + batch 56 content topics (28c) + `cpp`/`unreal-engine` stragglers (5c) + `boids` (35c) + **`steering-behaviors` (35c) + `three-steer` (7c)** + **`swarm-intelligence` (32c) + `pso.js` (4c, +3 symbols)** + **`crowd-simulation` (29c)** + **`flow-field-pathfinding` (43c)** + **`cellular-automata` (38c)**
- **GitHub source convention (established this session)**: vetted GitHub repos are first-class sources — clone to `knowledge/github/<repo>/`, require MIT/Apache-2.0 license, index only TS/JS/MD (`include: ["**/*.js", "**/*.md"]`); C#/C++/Java/Python repos are knowledge-only (parser can't read them). Added so far: `three-steer`, `pso.js`. See HANDOFF.md Notes.
- **Gotcha (embedding 502)**: transient OpenRouter 502 can leave chunks without vectors (export shows chunks ≠ vectors) — wipe `.sce` and re-index.
- **Still pending** (do NOT touch unless user asks): `spire-codex` (3.6 GB codebase clone — needs include-config decision), `unity-ebooks-scraped` (staging only, no config)

## Task pattern (proven by `boids`)

Hand-write comprehensive `.md` files — do **not** scrape (same as the PRNG topics: "conceptual algorithm topics with code examples"). Suggested shape per topic: 2–3 files, each ~8–11 KB, e.g. `<topic>-core.md` (model/concepts), `<topic>-implementation.md` (code), `<topic>-variants.md` (tuning / related models / game use). Use real C# (Unity-flavored where relevant). 7500-char chunks auto-split into parts — no action needed.

## Recommended topic queue (confirm each with user first)

### Tier A — direct boids family (highest priority)
1. ~~**steering-behaviors**~~ ✅ DONE (35c + GitHub `three-steer` 7c) — Reynolds' single-agent framework: seek, flee, arrive, pursue, evade, wander, obstacle avoidance, flow-field following.
2. ~~**swarm-intelligence**~~ ✅ DONE (32c + GitHub `pso.js` 4c) — PSO, ACO, ABC, firefly; optimization + procedural-design applications.
3. ~~**crowd-simulation**~~ ✅ DONE (29c, no GitHub source — candidates off-topic/unlicensed) — Helbing social-force model, lanes/queues, evacuation.
4. ~~**flow-field-pathfinding**~~ ✅ DONE (43c, no GitHub source — vonWolfehaus/flow-field unlicensed; Kristoff3r C# knowledge-only) — vector fields for mass unit movement; integration fields, dynamic obstacles, RTS shared-goal routing.
5. ~~**cellular-automata**~~ ✅ DONE (38c, no GitHub source — copy/life BSD-2 outside policy; Golly GPL knowledge-only) — Conway's Game of Life, Langton's ant, rule-based emergence, CA cave/terrain generation.

### Tier B — adjacent game-AI foundations
6. **spatial-partitioning** ⏳ NEXT — uniform grid, spatial hash, quadtree/octree, BVH, sweep-and-prune; implementation foundation (boids-implementation.md references it).
7. **behavior-trees** — hierarchical agent AI (composite/decorator/leaf nodes), blackboards.
8. **utility-ai** — scoring-based decision making (the modern alternative to behavior trees).
9. **genetic-algorithms** — evolutionary computation, NEAT, fitness tuning, procedural content.
10. **pathfinding** — A*, Dijkstra, Jump Point Search, navmesh, hierarchical pathfinding.

## Procedure (exact commands, run sequentially)

```bash
# 0. create topic
mkdir knowledge/<topic>        # write <topic>-*.md files + sce.config.json
#   config template: copy knowledge/boids/sce.config.json verbatim
#   (embedding: openai-compatible, OpenRouter, nvidia/llama-nemotron-embed-vl-1b-v2:free,
#    2048 dims, batchSize=1; indexing.include ["**/*.md"])

# 1. index (from the topic dir)
cd knowledge/<topic>
export OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY ../../packages/web/.dev.vars | cut -d'"' -f2)
node ../../packages/cli/dist/src/main.js index .

# 2. export (from repo root)
cd <repo-root>
node packages/cli/dist/src/main.js export -o knowledge/<topic>-export --path knowledge/<topic>

# 3. import (from packages/web) — sequential, never parallel
cd packages/web
npx tsx import.ts ../../knowledge/<topic>-export sce-db --append

# 4. verify in D1 (repo hash = sha256 of RESOLVED ABSOLUTE topic path, first 16 hex)
node -e "const{createHash}=require('node:crypto');const{resolve}=require('node:path');\
console.log(createHash('sha256').update(resolve('<abs-path-to>/<topic>')).digest('hex').slice(0,16))"
npx wrangler d1 execute sce-db --remote \
  --command "SELECT COUNT(*) as c FROM chunks WHERE repository_id='<hash>'"
#   output format is  "c": <num>  (space after colon) → grep -oE '"c": *[0-9]+'
npx wrangler d1 execute sce-db --remote \
  --command "SELECT (SELECT COUNT(*) FROM chunks) as chunks, (SELECT COUNT(*) FROM vectors) as vectors"

# 5. live end-to-end check
curl -s "https://sce-api.pasttime.xyz/api/search?q=<terms>&mode=keyword&limit=3"
```

## Docs to update + commit (always)

| File | What to touch | Note |
|------|---------------|------|
| `knowledge/INVENTORY.md` | new `<topic>` section (table + details), Status paragraph, D1 Live Total line | in gitignored dir → `git add -f` |
| `HANDOFF.md` | Status line, D1 Database stats block, Next Steps | normal add |
| `knowledge/EXPANSION-ROADMAP.md` | Status line, Current State bullets | `git add -f` |

Commit style: `feat(knowledge): add <topic> — <short desc>` (+ `docs:` for pure doc updates). Commit locally, never push. Verify docs totals match D1 before committing.

## Gotchas (hard-won this session — read before running)

1. **Stale `.sce` bug**: if a prior interrupted index left *file records but 0 chunks*, the indexer skips those files as "unchanged" (`existing.fileHash === fileHash` → `continue`) and reports `Indexed N files and 0 chunks`. Fix: `rm -rf .sce` and re-index. Symptom to check: export shows `0 chunks`.
2. **Unsupported languages silently produce 0 chunks** (e.g. `.gd` GDScript → `detectLanguage` returns `text`). If a topic's config includes non-md files, verify per-file chunk counts from the export before importing:
   `node -e "const c=require('./knowledge/<topic>-export/chunks.json');const m={};c.forEach(x=>m[x.relativePath]=(m[x.relativePath]||0)+1);console.log(m)"`
3. **`knowledge/` is gitignored** (`.gitignore` line 12). Content, `.sce`, and `-export` dirs are never committed. Doc updates inside `knowledge/` need `git add -f` (they're already tracked).
4. **Import sequentially** — the import script has race conditions with `.sce-import-tmp` when parallelized (noted in HANDOFF.md).
5. **Config `batchSize=1`** — free embedding model rate-limits; keep it at 1. All recent topic configs already use this.
6. **D1 queries**: `repository_id` is a 16-hex hash, not the topic name — always compute it via the `node -e` snippet above.
7. **OpenRouter key**: lives in `packages/web/.dev.vars` as `OPENROUTER_API_KEY="..."` — never print it.

## Acceptance criteria

- Export chunk count == vectors count (both > 0)
- D1 `COUNT(*)` for the topic hash == export chunk count
- D1 totals increased by exactly that amount (chunks and vectors)
- Live API search returns the new topic's content
- All 3 docs updated + committed on `develop`
