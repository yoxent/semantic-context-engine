# HANDOFF — Semantic Context Engine

**Last Updated**: 2026-11-08 (local embedding migration completed)
**Status**: D1 at **14,417 chunks, 5,313 vectors** after removing 2,904 junk chunks (`node_modules`/`.pi-subagents`) from the SCE repo corpus and re-importing it cleaned (317 chunks). **Embedding model changed** to `nvidia/nemotron-3-embed-1b:free` (2048-dim, ~12 points better on RTEB/MMTEB, 100% uptime vs the retiring `llama-nemotron-embed-vl-1b-v2`). **Local migration is COMPLETE** — 24 files / 393 chunks / 393 vectors, all on `nemotron-3-embed-1b`, no gaps. **D1 still holds old-model vectors** for the whole published corpus (14,417 chunks / 5,313 vectors on `llama-nemotron-embed-vl-1b-v2`); the SCE repo slice is 317 chunks / 146 vectors. The worker guard fails loudly on model mismatch instead of returning garbage scores. ⚠️ `embedding_config` in D1 is **global**, so importing one repo's export flips the model for every repository while old vectors remain — see the trap section in `docs/RESUME-embedding-migration.md` before any D1 run. `unity-ui-toolkit` is 86 chunks / 9 vectors (repository `f875ed6a8ea804b9`). **`ork-framework`** (4,550 chunks / 0 vectors, keyword only) imported 2026-11-03. Prior batch 55–56 + swarm topics + **`unity-gem-td` own-repo docs** (2,362 chunks, keyword-only) re-imported 2026-10-08. **`game-design-method`** (20 chunks / 20 vectors) imported 2026-10-26. **`gem-td-poe1-typed-damage`** (42 chunks / 0 vectors, keyword only) imported 2026-10-27. **Design-agent batch** (81 chunks / 0 vectors) imported 2026-10-28.

**⚠️ Known issues:** OpenRouter free tier is capped at **50 requests/day account-wide across all free models** (not per-model — verified on both models). Resets 08:00 UTC+8. This makes full-corpus re-embeds impractical (D1's 5,313 vectors ≈ 1,063 requests ≈ 21 days). Unity 6000.3 Manual pages failing to scrape (Scripting API works); Epic Games docs (dev.epicgames.com) entirely blocked for scraping. Import script has race conditions with `.sce-import-tmp` temp directory when parallelized; run sequentially. **Hosted demo semantic/hybrid** reranks a lexical candidate shortlist (~24 chunks) to stay within Cloudflare Workers Free CPU/D1 limits — full-corpus semantic runs locally via CLI/MCP.

---

## 🎯 Current State

### Live Demo
- **Frontend**: https://sce-web.pasttime.xyz/
- **API**: https://sce-api.pasttime.xyz/api/
- **D1 Database**: `sce-db` (14,417 chunks, 5,313 vectors)

### What's Working
| Feature | Status | Notes |
|---------|--------|-------|
| Keyword Search | ✅ | ~55ms, case-insensitive word AND, stopwords stripped |
| Semantic Search | ✅ | Demo: lexical candidates → embed → cosine rerank. Local: full corpus |
| Hybrid Search | ✅ | RRF fusion (k=60) of keyword + demo semantic leg |
| AST Search | ✅ | 3 symbols (only `pso.js` remains; the SCE purge removed its 290) |
| Ranking Boosts | ✅ | Filename (up to +8) > heading (up to +7) > snippet (+ up to 4) |
| Deduplication | ✅ | Max 2 hits per file |
| Frontend UI | ✅ | RetroUI theme + search-mode glossary, live hints, ranking explainer |
| Multi-Part Expansion | ✅ | Split chunks >7500 chars auto-expand in search results |

---

## 📊 D1 Database State

```
Chunks:  14,417
Vectors: 5,313 (2048-dim embeddings)
Symbols:  3
Topics:  ~219 knowledge + 4 own-repo corpora + 2 GitHub sources, plus game-design-method, gem-td-poe1-typed-damage, the curated design-agent topics, and ork-framework
Model:   nvidia/llama-nemotron-embed-vl-1b-v2:free (existing vectors)
         nvidia/nemotron-3-embed-1b:free (target — local rebuild in progress)
Size:    ~240 MB (approximate)
```

### Topics Indexed (~229)
- **Web stack**: HTML, CSS, jQuery, React, Next.js, Hono, shadcn/ui, shieldcn, Tailwind CSS, NativeWind, bolt.new, RetroUI, Dot Matrix
- **Full-stack**: TanStack Query, Next.js deep, React Hook Form, Auth.js v5, TypeScript patterns, Radix UI, Framer Motion, Drizzle ORM, Playwright, Caching Strategies
- **Testing**: TanStack Table, MSW, React Testing Library, ESLint, Sonner, Vitest
- **DevOps**: Vercel, Docker+Next.js, GitHub Actions, Sentry, Cloudflare Pages
- **Advanced**: Socket.io, Server-Sent Events, next/image, next/font, Metadata API
- **Backend**: Node.js, Express, FastAPI, Python, tRPC, REST API patterns
- **Cloud/DB**: Cloudflare Workers (full suite), D1, DO, KV, R2, Vectorize, Queues, Workers AI
- **DB**: PostgreSQL, Redis, Prisma, Drizzle ORM, SQLite, Supabase, BigQuery
- **Mobile**: Expo, React Native, Flutter, Dart, Firebase, AWS Amplify
- **Unity (6000.3)**: Base, ECS, Cinemachine, Netcode, Shaders, UI Toolkit, Addressables, ScriptableObjects, Events, Coroutines, Async, Scene Management, Collisions, Joints, Primitives
- **Unity Deep**: Particles/VFX, Post-Processing, Build Profiles, GPU Instancing/LOD, Camera, Input Interfaces, Editor Scripting, Player Settings, Graphics API
- **Unity Packages**: Post-Processing Stack, Scriptable Build Pipeline, Test Framework, UI Test Framework, Localization, Platform Toolkit, Addressables, Cinemachine 3, Netcode, Input System
- **Unity 6.6 Content Directories** (`content-directories`, 38 chunks / 36 vectors): Manual + Scripting API, Addressables 4.0 conversion, Unity blog, UnityDataTools on-disk format. Not in the 6000.3 manual.
- **Unity UI**: UGUI, UI Toolkit, TextMeshPro (93 chunks / 66 vectors). Dedicated `unity-ui-toolkit` expanded 2026-11-07 (86 chunks / 9 vectors) for 6000.3 architecture, lists, styling, performance, troubleshooting, game-UI patterns, and `IBinding` / `CustomBinding`. The deep UI Toolkit note is synced to those contracts. Keyword search is live. Vector backfill is waiting on the embedding quota.
- **Unity Cloud**: Cloud Save, Analytics, Remote Config, Leaderboards, Multiplayer, Economy, Authentication (87 chunks)
- **Unity Networking**: Photon PUN2/Fusion/Quantum, Mirror, FishNet, UTP, Nakama (72 chunks)
- **Unity Deepened**: Sampler State, Timeline, Game Juice/Microinteractions, Design Levers/Tuning, Game Designer Playbook (PDF)
- **Unity Ebooks**: Level Design, UI Design, Tech Art (x2), 2D Art/Animation/Lighting, Animation, VR/MR, Dedicated Server
- **Design Patterns**: Mobile UI, Material Design 3, Apple HIG (127 chunks)
- **IAP/Ads**: Unity IAP, Google Play Billing, StoreKit 2, RevenueCat, AdMob, AppLovin MAX, LevelPlay
- **Payment Platforms**: Stripe, PayPal, Paddle, Braintree, Lemon Squeezy
- **Figma/Canva**: REST API, Plugin API, Code Connect, Connect API, Apps SDK
- **Minimalist CSS**: Pico CSS, Water.css, MVP.css, new.css, Radix Themes
- **C#/.NET**: LINQ, ZLinq (139 chunks), Dependency Injection, Unit Testing
- **Unity Splines**: Deep reference (25 chunks)
- **Google Cloud**: Compute, Cloud Run, Functions, Storage, SQL, Firestore, Bigtable, Pub/Sub, GKE, IAM, etc. (185 chunks)
- **Python**: PyMuPDF (124 chunks) — PDF reading, image extraction, text search
- **Unity Profiling**: Profiler, Frame Debugger, Memory Profiler, GPU Optimization, Memory Budgeting, Build Size, Mobile Optimization
- **Profiling Deepen**: unity-profiler-deep (12), frame-debugger-deep (7), gpu-optimization-deep (4), build-size-optimization-deep (6), mobile-optimization-deep (4)
- **Game Settings/UI**: Save/Load, Responsive UI, Multi-Platform Input, UI Animation
- **Settings/UI Deepen**: game-settings-saveload-deep (6), responsive-game-ui-deep (7), multi-platform-input-deep (8)
- **Game Analytics/Audio**: Achievements, Leaderboards, Analytics, Crash Reporting, Audio, Addressables Deepen
- **Audio/Achievements Deepen**: game-audio-deep (9), game-achievements-deep (2), game-leaderboards-deep (2)
- **Multiplayer Deepen**: Session Management, Lag Compensation, Lockstep, State Sync
- **Multiplayer API Deepen**: session-management-deep (3), lag-compensation-deep (1), state-sync-patterns-deep (1)
- **Unreal Foundation**: Blueprints, Game Framework, UMG UI, Animation
- **Unreal Advanced**: Niagara VFX, Chaos Physics, Networking, Optimization
- **Unreal Deepen (Context7)**: unreal-blueprints-deep (10), unreal-game-framework-deep (8), unreal-umg-ui-deep (10), unreal-animation-deep (10), unreal-niagara-deep (7), unreal-chaos-deep (7), unreal-networking-deep (8), unreal-optimization-deep (9)
- **ORK 4 RPG Framework** (`ork-framework`, 4,550 chunks, keyword only): public ORK 4 system docs as a blueprint for our own Unity systems, plus ORK 3 pages with no ORK 4 counterpart and the runtime class cards whose old `/api/` URLs 404 with no Wayback capture. Not the tutorials or ORK 2 hub. Vectors deferred.
- **Game Dev**: Gem TD project docs (`unity-gem-td`, 2,362 chunks) — GDD / ARCHITECTURE / UI-SPEC / planning / SDD / wiki catalog; plus `gem-td-inspirations` (159 chunks, BTD5/6 Nordhold Infinitode). **`gem-td-poe1-typed-damage`** (42 chunks, 0 vectors): PoE 1 inspired Gem TD. Gem TD adopted some mechanics and interpreted them as a tower defense — a tower plus gems, not an active skill gem plus support gems. PoE rules, Gem TD design, and the greybox stay separate. Number differences are expected. **`game-design-method`** (20 chunks, 20 vectors): paraphrase of the usable design method from Reactorcore's book; competition, rewards, and shops stay with the game pillars.
- **Design-agent skills and browser graphics**: `design-agent-candidates` (8), `design-md` (7), `ui-ux-pro-max` (6), `taste-skill` (6), `open-design` (6), `emilkowalski-skills` (5), `gsap-skills` (6), `magic-ui` (5), `react-bits` (5), `canvas-ui` (5), `dimensional-drawing` (8), `threejs-web` (5), `webgpu` (5), and `react-native-motion` (4) — all keyword-only, curated notes with source/license boundaries. `impeccable` and `scroll-world` were already indexed and not duplicated.
- **Random Number Algorithms**: MegaRandom, xoshiro256**, SplitMix64, pseudorandom, shuffle bag, weighted random, noise (52 chunks)
- **AI Agent Skills**: scroll-world (46 chunks) — scroll-scrubbed 3D world landing pages
- Own-repo corpora: SCE packages (317 after cleanup — was 290, then 3,221 with junk), word-guess (423), web-portfolio (155), unity-gem-td docs (2,362)

---

## 🧹 Index Hygiene & Embedding Migration (2026-11-07)

### Root cause of the runaway index

`defaultIgnorePatterns` used root-anchored patterns (`node_modules/**`), which only match at the repo root. Because `FileDiscovery` also walked everything and filtered *afterwards*, monorepos silently indexed every nested `packages/*/node_modules/**`.

Measured effect on the SCE repo's own index: **2,778 of 3,221 chunks (86%) were noise** — `acorn/CHANGELOG.md` alone contributed 218 chunks, plus 1,102 chunks of `.pi-subagents` agent transcripts.

On a Unity project the effect was worse: `**/*.cs` discovered **8,575** files, of which **8,117** were `Library/PackageCache/` (a 5.1 GB, 61,603-file folder). Walking that with Defender active is the likely cause of a reported laptop crash.

### Fixes

| File | Change |
|---|---|
| `packages/core/src/config/defaults.ts` | Every pattern `**/`-prefixed (recursive). Added `.next`, `.turbo`, `.wrangler`, `.superpowers`, `.worktrees`, `.gradle`, `PackageCache`, `Logs`, `UserSettings`, `Build`, `Builds`, `MemoryCaptures`, `Recordings`, `.vs` |
| `packages/indexing/src/FileDiscovery.ts` | Pass `ignore` to `fast-glob` → prunes during traversal. Unity `**/*.cs`: 8,575 → 458 files, 115ms → 39ms |
| `packages/storage/src/SqliteStorage.ts` | `migrateSchema()` adds `part_index`/`total_parts` to legacy DBs (`CREATE TABLE IF NOT EXISTS` never adds columns). Four DBs were silently un-reindexable |
| `packages/indexing/src/Indexer.ts` | **Roll back the `files` record when embedding fails.** `saveFile()` ran *before* `embed()`, so a 429 left the file marked "unchanged" with zero vectors — skipped forever, invisible to semantic search |

The `Indexer` bug is the likely explanation for stale-vector gaps previously noted here (e.g. `cpp`/`unreal-engine` having file records but 0 chunks).

### D1 cleanup

Purged and re-imported the SCE repo corpus (`5ebbc9b9d0a0e258`): 3,221 → 317 chunks, 776 → 146 vectors. D1 totals went **17,321 → 14,417 chunks**, **5,943 → 5,313 vectors**. Verified by live search: `acorn AggregateType walker` now returns 0 results.

Side effect: D1 symbols dropped **290 → 3**. Only `pso.js` symbols remain; AST search is effectively dormant until own-repo code is re-indexed.

### Embedding model change

`nvidia/llama-nemotron-embed-vl-1b-v2:free` → **`nvidia/nemotron-3-embed-1b:free`**.

| | Old | New |
|---|---|---|
| Dimensions | 2048 | **2048** (compatible) |
| Parameters | ~1.7B | ~1.14B |
| Modality | text + image | text only |
| RTEB 16 (NDCG@10) | 61.98 | **72.38** |
| MMTEB Retrieval | 59.71 | **71.05** |
| Availability | being retired | 100% |

**Dimension match does not make old vectors reusable** — `SqliteVectorStore` filters on exact model name, so a model change is always a full re-embed. Added `assertVectorModelMatches()` in the worker: `scoreVectorsForIds` only compares array *lengths*, so a mismatch would have silently produced meaningless scores instead of failing.

### Quota reality

OpenRouter free tier is **50 requests/day, account-wide across all free models** (verified identical on both models — reverting gains nothing). Resets 08:00 UTC+8.

Batching is per-file, not global: `Indexer` calls `embed()` once per file and the provider batches inside that call. Real cost is `Σ ceil(fileChunks / batchSize)`, not `ceil(total / batchSize)`.

Because cost rounds up per file, a large `batchSize` pays off. Root `sce.config.json` uses `batchSize: 10` — measured 37 requests for the repo instead of 63 at `batchSize: 5` (which would not have fit the 50/day budget). Worst-case real payload at `batchSize: 10` is 11,670 tokens, against the model's 32,768 limit.

A full D1 re-embed (5,313 vectors) still needs ≈ **1,063 requests ≈ 21 days** on the free tier at `batchSize: 5`, and the same per-file rounding applies.

**Local migration: COMPLETE (2026-11-08).** 24 files / 393 chunks / 393 vectors, all on `nvidia/nemotron-3-embed-1b:free`, no gaps, FTS in sync, integrity ok. Keyword, semantic, and hybrid all verified.

Still outstanding: **D1** (holds the old model) and the **other local databases** (`packages/.sce`, `word-guess/.sce`, `web-portfolio/.sce`, `knowledge/*/.sce`). Details in `docs/RESUME-embedding-migration.md`.

---

## 🔍 Search Improvements

### Free-Plan Demo Semantic Fix (2026-08-14)

**Problem:** Full-table `SELECT` of ~5.8k JSON embeddings (~40KB each) hit `D1_ERROR: Memory limit exceeded before EOF`. Loading and scoring the entire corpus in one Worker request also exceeded Workers Free CPU (10ms).

**Fix (hosted demo only):**
1. **Keyword candidates** — `fetchCandidateChunkIds()` picks up to ~24 chunk IDs via SQL (AND, then OR on distinctive terms; stopwords stripped; excludes `node_modules`).
2. **Cosine rerank** — `scoreVectorsForIds()` embeds the query and scores only those IDs in small D1 batches.
3. **Hybrid** — keyword list + candidate-limited semantic, fused with RRF (k=60).

Local CLI/MCP still uses `@sce/retrieval` full-corpus semantic over SQLite.

**Frontend:** Mode taglines (Exact terms / By meaning / Recommended), live hint panel, collapsible glossary with ranking steps.

### Case-Insensitive, Word-Based Search (2026-07-28)
**Before**: `LIKE '%query%'` — exact phrase, case-sensitive
**After**: `LOWER(text) LIKE '%word1%' AND LOWER(text) LIKE '%word2%'` — word-based AND, case-insensitive

**Impact**:
- "level design synthesis" now finds results (was 0, now 2+)
- "shader graph node" now finds results (was 0, now 2+)
- All queries work regardless of case or word order

**Implementation**:
```typescript
// Split query into words
const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);

// Build AND conditions for each word
const wordConditions = words.map(() => 
  "(LOWER(text) LIKE ? OR LOWER(relative_path) LIKE ? OR LOWER(heading_path) LIKE ?)"
).join(" AND ");
```

---

## 📚 PDF Reading Capability

**Status**: Working — PyMuPDF v1.28.0 installed

### Pipeline
```bash
# Extract text from PDF
python -c "import pymupdf; doc=pymupdf.open('path/to/file.pdf'); print('\n'.join([page.get_text() for page in doc]))"

# Extract images from PDF
python -c "import pymupdf; doc=pymupdf.open('path/to/file.pdf'); [doc.extract_image(img[0]) for page in doc for img in page.get_images()]"

# Describe images via OpenRouter free vision model
# Model: google/gemma-4-26b-a4b-it:free
# Limit: 50 requests/day (free tier)
```

### Tested On
- Unity Game Designer Playbook (103 pages, 149K chars, 131 images)
- Unity Ebooks (7 PDFs, ~700 pages total)

### Image Description Progress
- 49/131 images described (pages 1-44)
- Free tier daily limit hit (50 requests/day)
- Script saves progress, can resume: `python knowledge/unity-game-designer-playbook/describe_images.py`

---

## 🤖 MCP Server (AI Agent Integration)

### Global Install
```bash
# Already installed globally
sce-mcp
```

### Config Locations
- Linux/Mac: `~/.config/mcp/sce.json`
- Windows: `~/AppData/Roaming/MCP/sce.json`

### Available Tools
- `search_knowledge` - Search the knowledgebase
- `get_document` - Get full content of a chunk
- `list_sources` - See what's indexed
- `get_stats` - Database statistics

### Usage in AI Agents
Any MCP-compatible agent can now use:
> "Search the knowledgebase for D1 patterns"

---

## 🔧 Configuration

### API Key
- **Location**: `packages/web/.dev.vars` (used by worker locally; also stored as Cloudflare secret)
- **Env var**: `OPENROUTER_API_KEY`
- **Usage**: Set via `export OPENROUTER_API_KEY="..."` before running CLI commands (index, export)

### Worker Config
- **sce-api**: `packages/web/worker/wrangler.toml`
  - D1 binding: `DB` → `sce-db`
  - Secret: `OPENROUTER_API_KEY` (set)
  - Main: `src/index.ts`

- **sce-web**: `packages/web/wrangler.jsonc`
  - Static assets: `frontend/`
  - No bindings needed

### Search Modes

| Mode | Tagline | Hosted demo | Local CLI/MCP |
|------|---------|-------------|---------------|
| **keyword** | Exact terms | SQL LIKE, word AND | Same |
| **semantic** | By meaning | Candidates → embed → cosine rerank | Full vector store scan |
| **hybrid** | Recommended | Keyword + demo semantic, RRF k=60 | Full keyword + full semantic, RRF |
| **ast** | Symbols | API/MCP only | Exact then prefix symbol lookup |

Ranking (keyword & semantic legs): filename boosts strongest, then heading, then snippet; max 2 hits per file. Hybrid final score is RRF sum (`1/(60+rank)` per list).

1. **keyword**: SQL LIKE over text, path, heading (~55ms) — case-insensitive, word-based AND
2. **semantic**: OpenRouter embedding → cosine similarity (demo: ~24 lexical candidates first)
3. **hybrid**: RRF fusion of keyword + semantic (k=60)
4. **ast**: Symbol table lookup — exact match then prefix fallback

> **Note**: AST search is API/MCP only (not in frontend UI). After the SCE corpus purge only 3 symbols remain (`pso.js`), so AST search is effectively dormant until more own-repo code is re-indexed.

### Multi-Part Document Expansion
When chunks exceed ~7500 chars, the indexer splits them into linked parts. The search API automatically expands multi-part results: when a search hits any part of a split document, all sibling parts are returned together.

---

## 🚀 Deployment Commands

```bash
# Deploy API Worker
cd packages/web/worker
npx wrangler deploy --config wrangler.toml

# Deploy Frontend
cd packages/web
npx wrangler deploy

# Import data to D1
npx tsx packages/web/import.ts ./export-dir sce-db

# Append mode (don't clear existing data)
npx tsx packages/web/import.ts ./export-dir sce-db --append

# Vectors only (skip chunks)
npx tsx packages/web/import.ts ./export-dir sce-db --vectors-only
```

---

## 📁 Project Structure

```
packages/
  web/
    worker/
      src/
        index.ts        # Worker entry point (routing)
        search.ts       # Search implementation (4 modes)
        candidates.ts   # Lexical candidate IDs for demo semantic
        vectorScan.ts   # Batched embedding fetch + cosine for candidates
        embedding.ts    # OpenRouter embedding client
        cosine.ts       # Cosine similarity
        d1.ts           # D1 query builders
      wrangler.toml     # Worker config
    frontend/
      index.html        # UI
      style.css         # Dark theme styles
      app.js            # Search UI logic
    schema.sql          # D1 schema
    import.ts           # D1 import script
    scraper.ts          # Atlassian docs scraper
    cf-scraper.ts       # Cloudflare docs scraper
    wrangler.jsonc      # Frontend Worker config
  core/                 # SCE engine (local)
  cli/                  # SCE CLI
  embedding/            # Embedding providers
```

---

## 🎬 Demo Script

### For Job Application Demo

1. **Open**: https://sce-web.pasttime.xyz/
2. **Show keyword search**: Type "D1 database" — notice highlighted terms
3. **Show search modes**: Click through Keyword → Semantic → Hybrid
4. **Show response times**: Point out ~55ms keyword, semantic search
5. **Show result features**: Click card to expand, copy button, score display
6. **Show search history**: Recent searches appear below suggestions
7. **Show stats**: 7,533 chunks of documentation indexed

### Key Talking Points
- "7,533 chunks of documentation indexed in D1"
- "3 search modes: keyword, semantic, hybrid (AST for API/MCP)"
- "Sub-100ms keyword search, semantic search via OpenRouter"
- "Built for AI coding agents as the primary consumer"
- "Edge-deployed on Cloudflare Workers for global low-latency"
- "Multi-part document splitting for long docs (auto-expands in search)"
- "Unity 6000.3 full coverage: Scripting API, Manual, Packages, UI, Cloud, Networking"
- "Full-stack web: React, Next.js, Vercel, Docker, Sentry, testing, deployment"
- "Frontend: search highlighting, expandable cards, copy button, search history, ARAccessible"
- "PDF reading pipeline: PyMuPDF extraction + vision model image descriptions"
- "Case-insensitive, word-based search for better discoverability"

---

## 📈 Ranking Improvements (2026-07-25)

Enhanced ranking with multi-word query handling and content quality signals:

| Boost Type | Points | Description |
|------------|--------|-------------|
| **Filename** | | |
| Exact filename | +8 | Query exactly matches file stem |
| Filename phrase | +6 | Query phrase found in filename |
| All terms in filename | +5 | All query terms in filename |
| Some terms in filename | +3-4 | Partial term matches |
| **Heading** | | |
| Exact heading | +7 | Query exactly matches heading |
| Heading phrase | +5 | Query phrase in heading |
| All terms in heading | +4 | All query terms in heading |
| Some terms in heading | +2-3 | Partial heading matches |
| **Content** | | |
| Exact phrase in text | +4 | Full query in chunk text |
| Ordered terms in text | +3 | Terms appear in query order |
| All terms in text | +2 | All terms present |
| **Quality** | | |
| Long content (1000+) | +2 | Detailed content bonus |
| Medium content (500+) | +1 | Moderate content bonus |
| Heading depth (2+) | +1 | Structured content bonus |

**Deduplication**: Max 2 hits per file to improve result diversity.

Applied to: keyword, semantic, and hybrid search modes.

---

## 🔜 Next Steps

### Immediate — Tier 1/2 Import ✅ COMPLETE (except spire-codex)
- **Batch 55 complete**: sprite-atlasing (13c), node-graphs (16c), storage-logic (14c), game-design-patterns (12c), net-code (16c) — 71 chunks, 71 vectors.
- **Stragglers cleared**: `cpp` (4c) + `unreal-engine` (1c) — stale `.sce` had file records but 0 chunks (indexer skipped as "unchanged"); wiped and re-indexed.
- **Batch 56 partial**: slay-the-spire-2 (17c) + sts2-enemies-ai-brain (11c) in D1.
- **New topic**: `boids` (35c, 3 files) — Reynolds distributed behavioral model: core rules, implementation tiers (MonoBehaviour → spatial hash → ECS/Burst → compute shader), variants (herds/schools/swarms, PSO/ACO, crowds).
- **New topic**: `steering-behaviors` (35c, 3 files) + GitHub `three-steer` (7c, MIT) — Reynolds single-agent framework: seek/flee/arrive/pursue/evade/wander, obstacle avoidance, path follow, flow-field following.
- **New topic**: `swarm-intelligence` (32c, 3 files) — PSO (velocity update, inertia/cognitive/social, gbest/lbest), ACO (pheromone, evaporation, AS/ACS/MMAS), ABC, firefly; C# implementations (PSO class, TSP ACO, ABC), evaluation-budget playbook, game applications (parameter tuning, path smoothing, procedural content).
- **New topic**: `crowd-simulation` (29c, 3 files) — Helbing social-force model, emergent lanes/queues, evacuation, RVO comparison.
- **New topic**: `flow-field-pathfinding` (43c, 3 files) — integration fields, flow vector generation, RTS mass movement, dynamic obstacle updates; bridges boids/steering to shared-goal pathfinding.
- **New topic**: `cellular-automata` (38c, 3 files) — Conway's Life, Wolfram 1D rules, Langton's ant, cave-generation CA, tilemap pipeline.
- **New GitHub source**: `pso.js` (4c, MIT, adrianton3) — second GitHub source; `src/pso.js` + README; **3 AST symbols** (first JS symbols in D1). Note: embedding API 502 mid-run can leave chunks without vectors — wipe `.sce` and re-index if export shows chunks ≠ vectors.
- **`game-design-method`** (20c / 20v, 2026-10-26) and **`gem-td-poe1-typed-damage`** (42c / 0v, 2026-10-27) are in D1. Typed damage is keyword-only until a vector backfill. PoE 1 is an inspiration: tower plus gems, not an active skill gem plus support gems. Numeric differences are expected.
- Remaining: **spire-codex** (3.6 GB codebase clone — needs include-config decision before indexing; also `.gd`/GDScript files are unsupported by the parser), unity-ebooks-scraped (staging only, no config). Vector backfill for keyword-only corpora (`unity-gem-td` docs, `gem-td-poe1-typed-damage`).

### Expansion Status (Batches 42–56) — Game Dev & Infrastructure Topics

| Batch | Focus | Topics | Status |
|-------|-------|--------|--------|
| **42** | Steamworks & Platform Distribution | Steamworks SDK, Windows GDK, cross-platform publishing | ✅ Done (152 chunks) |
| **43** | Anti-Cheat & Security | Easy Anti-Cheat, BattlEye, anti-tamper, server authority | ✅ Done (72 chunks) |
| **44** | Profiling & Performance | Profiler, Frame Debugger, GPU opt, build size, mobile opt | ✅ Done (20 chunks) |
| **45** | Settings/Save/Load & UI | Save/Load, responsive UI, multi-platform input, UI animation | ✅ Done (7 chunks) |
| **46** | Analytics, Audio & Achievements | Achievements, analytics, crash reporting, FMOD/Wwise, Addressables | ✅ Done (7 chunks) |
| **47** | Multiplayer Deepen | Session/reconnect, lag compensation, lockstep, state sync | ✅ Done (4 chunks) |
| **48** | Unreal Engine Foundation | Blueprints, GAS, UMG, Animation | ✅ Done (4 chunks, stub content) |
| **49** | Unreal Engine Advanced | Niagara, Chaos, Networking, Nanite/Lumen | ✅ Done (4 chunks, stub content) |
| **54** | Random Number Algorithms | MegaRandom, xoshiro256**, SplitMix64, pseudorandom, game random utils | ✅ Done (52 chunks, 52 vectors) |
| **55** | Game Dev Infrastructure | Sprite atlasing, node graphs, storage logic, design patterns, net code | ✅ Done (71 chunks, 71 vectors) |
| **56** | StS2 & Codex | Slay the Spire 2 architecture, Spire Codex, sts2-enemies-ai-brain | ⏳ Partial (2/3: slay-the-spire-2 17c, sts2-enemies-ai-brain 11c; spire-codex pending decision) |

**⚠️ Known scraping issues:**
- Unity 6000.3 Manual pages: most fail to scrape (Scripting API pages work if URL has no dots)
- dev.epicgames.com: entirely blocks the cf-scraper (all Unreal topics have placeholder stubs)

See `knowledge/EXPANSION-ROADMAP.md` for full batch details and URL sources.

### Optional Future Work
- **Deepen specific topics**: More Unity packages (ML-Agents, Shader Graph)
- **Add symbol data**: Index more codebases with AST extraction
- **Performance**: Optimize semantic search latency
- **UI enhancements**: Loading skeletons, pagination

---

## 🐛 Known Issues

1. **Import batch size**: Reduced to 2 to avoid SQLITE_TOOBIG errors with large chunks
1a. **Vector import slow**: Each 2048-dim vector (~39KB) is inserted one-at-a-time via separate `wrangler d1 execute` call (~2-7s each). Topics with 100+ vectors take 10-20 minutes. Import sequentially (not parallel) to avoid temp file races.
2. **wrangler.jsonc interference**: Must use `--config wrangler.toml` when deploying worker from `packages/web/worker/`
3. **Free embedding rate limits**: OpenRouter free model occasionally rate-limits; batch size 2 mitigates this
4. **D1 schema snake_case**: D1 uses `repository_id`, `relative_path`, etc. (snake_case) but export uses camelCase. Import scripts must map fields correctly.
5. **Free vision model limit**: 50 requests/day for image description; script saves progress and can resume
6. **PDF chunking**: Large PDFs (100K+ chars) must be split into <50KB files before indexing to avoid SQL statement size limits

---

## 📝 Notes

- Frontend uses dark theme, responsive design, keyboard shortcuts (`/` to focus search, `Esc` to clear)
- API supports CORS for cross-origin frontend access
- D1 import uses `INSERT OR REPLACE` for idempotent re-imports
- Each vector is ~39KB as JSON (2048 floats), batch size = 2 to stay under D1's ~100KB statement limit
- Cloudflare docs scraper available at `packages/web/cf-scraper.ts`
- **Re-import (2026-07-25)**: All 149 knowledge topics re-imported after discovering D1 had only 3221 chunks (own-repo corpora). Used bulk SQL generation with correct snake_case schema. Total: 6590 chunks, 3611 vectors, ~170 MB.
- Unity docs scraped via Context7 for better reliability (SPA JS rendering)
- **PDF pipeline (2026-07-26)**: PyMuPDF installed for PDF text/image extraction. Test: Unity Game Designer Playbook (103 pages, 131 images). Vision model: google/gemma-4-26b-a4b-it:free (50 req/day limit)
- **Knowledge expansion (2026-07-26)**: Added 7 new topics (Sampler State, Gem TD, PyMuPDF, Game Designer Playbook, Timeline, Game Juice, Design Levers). Total: 156 topics, 7,086 chunks
- **Unity Ebooks (2026-07-28)**: Added 8 topics from Unity PDFs (Level Design, UI Design, Tech Art x2, 2D Art, Animation, VR/MR, Dedicated Server). Total: 173 topics, 7,533 chunks
- **Search improvement (2026-07-28)**: Case-insensitive, word-based AND matching. Multi-word queries like "level design synthesis" now work. Deploy time: ~10 seconds.

- **Batch 54 (Random Number Algorithms)**: 5 topics added — megarandom, xoshiro256**, SplitMix64, pseudorandom, game-random-utils (52 chunks, 52 vectors). Content includes C# implementations, algorithm properties, and game-specific usage patterns.
- **GitHub open-source sources (2026-08-05)**: GitHub repos are now a first-class source type. Clone to `knowledge/github/<repo>/` (gitignored), add `sce.config.json` with `include: ["**/*.js", "**/*.md"]` (ignore `libs/**`, `js/threejs/**`, `examples/**`), index/export/import like any topic. Only add permissively-licensed repos (MIT/Apache-2.0); skip no-license repos (copyright). Parser supports only TS/JS + MD — C#/C++/Java/Python repos cannot be indexed directly; distill their knowledge into hand-written topic files instead (with attribution). Sources added so far: `three-steer` (MIT), `pso.js` (MIT, +3 AST symbols).
- **Gitignored source files**: `knowledge/` dir is in `.gitignore`. New knowledge source files (.md) and GitHub clones under `knowledge/github/` are tracked only in D1, not git. Only HANDOFF.md, EXPANSION-ROADMAP.md, and INVENTORY.md are version-controlled.
- **unity-gem-td docs (2026-08-21)**: Indexed live design docs from `E:\Projects\Docs\project-docs\Unity\unity-gem-td` (102 files → 959 chunks, 0 vectors). Excluded `sources/`. Did **not** index Unity `Assets/` C# (unsupported language). Context Mode `GemTD-docs` also refreshed (106 files / 754 sections). Re-index: `node packages/cli/dist/src/main.js index .` from docs root → export → delete `repository_id` `941f4e5d1369477d` from D1 → `import.ts … --append`. Vector backfill via `scripts/backfill-vectors.mjs` when ready.
- **unity-gem-td docs (2026-10-08)**: Re-indexed the same docs root (237 files → 2,362 chunks, 0 vectors). Replaced the previous 959 D1 rows for that repository. Context Mode `GemTD-docs` refreshed (237 files / 1,813 sections). Keyword search confirmed on `planning/2026-10-08-display-naming-catalog.md`. Still keyword-only until vector backfill.
