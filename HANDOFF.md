# HANDOFF — Semantic Context Engine

**Last Updated**: 2026-08-05
**Status**: D1 at **9,954 chunks, 5,715 vectors**. **BATCH 55 COMPLETE** (71 chunks) + batch 56 content topics + `cpp`/`unreal-engine` stragglers + **new `boids` topic** (35 chunks) imported. Remaining backlog: `spire-codex` (needs include-config decision), `unity-ebooks-scraped` (staging only).

**⚠️ Known issues:** Unity 6000.3 Manual pages failing to scrape (Scripting API works); Epic Games docs (dev.epicgames.com) entirely blocked for scraping. Unreal deepen topics created via Context7-generated markdown + written content. Backfill script (`scripts/backfill-vectors.mjs`) available to regenerate embedding vectors for topics indexed without an embedding config. Import script has race conditions with `.sce-import-tmp` temp directory when parallelized; run sequentially.

---

## 🎯 Current State

### Live Demo
- **Frontend**: https://sce-web.pasttime.xyz/
- **API**: https://sce-api.pasttime.xyz/api/
- **D1 Database**: `sce-db` (9,954 chunks, 5,715 vectors)

### What's Working
| Feature | Status | Notes |
|---------|--------|-------|
| Keyword Search | ✅ | ~55ms response, 8,019 chunks, **case-insensitive, word-based AND** |
| Semantic Search | ✅ | Vectors, 2048-dim |
| Hybrid Search | ✅ | RRF fusion (k=60) |
| AST Search | ✅ | 287 symbols (own-repo corpora) |
| Ranking Boosts | ✅ | Filename +5, Heading +4, Snippet +2 |
| Deduplication | ✅ | Max 2 hits per file |
| Frontend UI | ✅ | RetroUI neobrutalist theme, dark, responsive, keyboard shortcuts, search highlighting, expandable cards, copy button, search history, ARIA accessible |
| Multi-Part Expansion | ✅ | Split chunks >7500 chars auto-expand in search results |

---

## 📊 D1 Database State

```
Chunks:  9,954
Vectors: 5,715 (2048-dim embeddings)
Symbols: 287 (own-repo corpora)
Topics:  ~212 knowledge + 3 own-repo corpora = ~215 total
Model:   nvidia/llama-nemotron-embed-vl-1b-v2:free
Size:    ~190 MB
```

### Topics Indexed (~228)
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
- **Unity UI**: UGUI, UI Toolkit, TextMeshPro (92 chunks)
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
- **Game Dev**: Gem TD project (159 chunks) — architecture, combat, gems, pooling, TD inspirations
- **Random Number Algorithms**: MegaRandom, xoshiro256**, SplitMix64, pseudorandom, shuffle bag, weighted random, noise (52 chunks)
- **AI Agent Skills**: scroll-world (46 chunks) — scroll-scrubbed 3D world landing pages
- Own-repo corpora: SCE packages (290), word-guess (423), web-portfolio (155)

---

## 🔍 Search Improvements

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
1. **keyword**: SQL LIKE over text, path, heading (~55ms) — **case-insensitive, word-based AND**
2. **semantic**: OpenRouter embedding → cosine similarity (needs vectors)
3. **hybrid**: RRF fusion of keyword + semantic (k=60)
4. **ast**: Symbol table lookup — exact match then prefix fallback

> **Note**: AST search is API/MCP only (not in frontend UI). With 287 symbols indexed, it's more useful for AI agents than human users.

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
        search.ts       # Search implementation (4 modes, case-insensitive)
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
- Remaining: **spire-codex** (3.6 GB codebase clone — needs include-config decision before indexing; also `.gd`/GDScript files are unsupported by the parser), unity-ebooks-scraped (staging only, no config).

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
- **Gitignored source files**: `knowledge/` dir is in `.gitignore`. New knowledge source files (.md) are tracked only in D1, not git. Only HANDOFF.md, EXPANSION-ROADMAP.md, and INVENTORY.md are version-controlled.
