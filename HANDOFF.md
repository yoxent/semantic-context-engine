# HANDOFF — Semantic Context Engine

**Last Updated**: 2026-07-25
**Status**: All planned expansion batches (1–28, 29–36) complete, 5532 chunks indexed

---

## 🎯 Current State

### Live Demo
- **Frontend**: https://sce-web.pasttime.xyz/
- **API**: https://sce-api.pasttime.xyz/api/
- **D1 Database**: `sce-db` (5532 chunks, 3019 vectors)

### What's Working
| Feature | Status | Notes |
|---------|--------|-------|
| Keyword Search | ✅ | ~55ms response, 5532 chunks |
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
Chunks:  5532
Vectors: 3019 (2048-dim embeddings)
Symbols: 287 (own-repo corpora)
Topics:  ~137
Model:   nvidia/llama-nemotron-embed-vl-1b-v2:free
```

### Topics Indexed (~137)
- **Web stack**: HTML, CSS, jQuery, React, Next.js, Hono, shadcn/ui, shieldcn, Tailwind CSS, NativeWind, bolt.new, RetroUI, Dot Matrix
- **Full-stack (Batch 24)**: TanStack Query (131 chunks), Next.js deep, React Hook Form, Auth.js v5, TypeScript patterns
- **Full-stack UI (Batch 25)**: Radix UI (303 chunks), Framer Motion, Drizzle ORM deep, Playwright, Caching Strategies
- **Testing (Batch 26)**: TanStack Table, MSW, React Testing Library, ESLint, Sonner
- **DevOps (Batch 27)**: Vercel deep, Docker+Next.js (202 chunks), GitHub Actions, Sentry, Cloudflare Pages
- **Advanced (Batch 28)**: Socket.io, Server-Sent Events, next/image, next/font, Metadata API
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
- **Design Patterns**: Mobile UI, Material Design 3, Apple HIG (127 chunks)
- **IAP/Ads**: Unity IAP, Google Play Billing, StoreKit 2, RevenueCat, AdMob, AppLovin MAX, LevelPlay
- **Payment Platforms**: Stripe, PayPal, Paddle, Braintree, Lemon Squeezy
- **Figma/Canva**: REST API, Plugin API, Code Connect, Connect API, Apps SDK
- **Minimalist CSS**: Pico CSS, Water.css, MVP.css, new.css, Radix Themes
- **C#/.NET**: LINQ, ZLinq (139 chunks), Dependency Injection, Unit Testing
- **Unity Splines**: Deep reference (25 chunks)
- **Google Cloud**: Compute, Cloud Run, Functions, Storage, SQL, Firestore, Bigtable, Pub/Sub, GKE, IAM, etc. (185 chunks)
- Own-repo corpora: SCE packages (290), word-guess (423), web-portfolio (155)

### Expansion Batches — ALL COMPLETE ✅

| Batch | Topics | Chunks | Status |
|-------|--------|--------|--------|
| 1–9, 14–16 | Mobile, portfolio, base corpus, Unity basics | ~600 | ✅ |
| 24 | TanStack Query, Next.js deep, React Hook Form, Auth.js, TS patterns | 178 | ✅ |
| 25 | Radix UI, Framer Motion, Drizzle deep, Playwright, Caching | 495 | ✅ |
| 26 | TanStack Table, MSW, Testing Library, ESLint, Sonner | 226 | ✅ |
| 27 | Vercel deep, Docker, GitHub Actions, Sentry, Cloudflare Pages | 448 | ✅ |
| 28 | Socket.io, SSE, next/image, next/font, Metadata | 239 | ✅ |
| 29–33 | Unity Cloud, UI, Design Patterns, Minimalist CSS, ZLinq | ~800 | ✅ |
| 34–35 | IAP/Ads/Networking, Figma/Canva, Payments, RetroUI, Splines | ~560 | ✅ |
| Unity 10–23 | Particles, Post-Processing, Build, v6, Renderers, Camera, Interfaces, Editor, Player, Graphics | 202 | ✅ |
| Unity Packages | Post-Processing, Build Pipeline, Test Framework, Localization, Platform Toolkit, Addressables, Cinemachine 3, Netcode, Input System | 279 | ✅ |

See `knowledge/EXPANSION-ROADMAP.md` for full details.

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
1. **keyword**: SQL LIKE over text, path, heading (~55ms)
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
        search.ts       # Search implementation (4 modes)
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
7. **Show stats**: 5532 chunks of documentation indexed

### Key Talking Points
- "5532 chunks of documentation indexed in D1"
- "3 search modes: keyword, semantic, hybrid (AST for API/MCP)"
- "Sub-100ms keyword search, semantic search via OpenRouter"
- "Built for AI coding agents as the primary consumer"
- "Edge-deployed on Cloudflare Workers for global low-latency"
- "Multi-part document splitting for long docs (auto-expands in search)"
- "Unity 6000.3 full coverage: Scripting API, Manual, Packages, UI, Cloud, Networking"
- "Full-stack web: React, Next.js, Vercel, Docker, Sentry, testing, deployment"
- "Frontend: search highlighting, expandable cards, copy button, search history, ARIA accessible"

---

## 📈 Ranking Improvements (2026-07-25)

Added SimpleRanker boosts and deduplication to all search modes:

| Boost Type | Points | Description |
|------------|--------|-------------|
| Filename match | +5 | Query terms found in filename |
| Heading match | +4 | Query terms found in heading path |
| Snippet exact | +2 | Full query found in chunk text |

**Deduplication**: Max 2 hits per file to improve result diversity.

Applied to: keyword, semantic, and hybrid search modes.

---

## 🔜 Next Steps

### All Expansion Batches Complete ✅
The knowledge base is now comprehensive across all planned topics.

### File Renaming Needed
850+ files across ALL topics have URL-based filenames that don't benefit from filename search boosts:

| Topic | Files | Example Current → Target |
|-------|-------|--------------------------|
| Unity | ~260 | `https___docs_unity3d_com_...html.md` → `unity-addressables.md` |
| Google Cloud | 64 | `https___cloud_google_com_...html.md` → `gcp-cloud-run.md` |
| Radix UI | 41 | `https___www_radix_ui_...html.md` → `radix-dialog.md` |
| Next.js | 31 | `https___nextjs_org_docs_...html.md` → `nextjs-app-router.md` |
| Drizzle | 31 | `https___orm_drizzle_team_...html.md` → `drizzle-migrations.md` |
| + 50 more | ~420 | Various frameworks and libraries |

**Workflow:**
1. Rename files in `knowledge/<topic>/` using `git mv`
2. Re-index: `node packages/cli/dist/src/main.js update .`
3. Re-export: `node packages/cli/dist/src/main.js export -o <export-dir> --path .`
4. Re-import: `npx tsx packages/web/import.ts <export-dir> sce-db --append`

**Full task plan:** `docs/TASK-rename-files.md`

### Optional Future Work
- **Deepen specific topics**: More Unity packages (Timeline, ML-Agents, Shader Graph)
- **Add symbol data**: Index more codebases with AST extraction
- **Performance**: Optimize semantic search latency
- **UI enhancements**: Loading skeletons, pagination

---

## 🐛 Known Issues

1. **Import batch size**: Reduced to 2 to avoid SQLITE_TOOBIG errors with large chunks
2. **wrangler.jsonc interference**: Must use `--config wrangler.toml` when deploying worker from `packages/web/worker/`
3. **Free embedding rate limits**: OpenRouter free model occasionally rate-limits; batch size 2 mitigates this

---

## 📝 Notes

- Frontend uses dark theme, responsive design, keyboard shortcuts (`/` to focus search, `Esc` to clear)
- API supports CORS for cross-origin frontend access
- D1 import uses `INSERT OR REPLACE` for idempotent re-imports
- Each vector is ~39KB as JSON (2048 floats), batch size = 2 to stay under D1's ~100KB statement limit
- Cloudflare docs scraper available at `packages/web/cf-scraper.ts`
- Unity docs scraped via Context7 for better reliability (SPA JS rendering)
