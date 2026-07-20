# HANDOFF — Semantic Context Engine

**Last Updated**: 2026-07-19
**Status**: Web deployment functional, Batch 24 (Full-Stack React/Next.js) indexed

---

## 🎯 Current State

### Live Demo
- **Frontend**: https://sce-web.pasttime.xyz/
- **API**: https://sce-api.pasttime.xyz/api/
- **D1 Database**: `sce-db` (2085 chunks, 207 vectors)

### What's Working
| Feature | Status | Notes |
|---------|--------|-------|
| Keyword Search | ✅ | ~55ms response, 2085 chunks |
| Semantic Search | ✅ | Vectors, 2048-dim |
| Hybrid Search | ✅ | RRF fusion (k=60) |
| AST Search | ✅ | 287 symbols (own-repo corpora) |
| Frontend UI | ✅ | RetroUI neobrutalist theme + Dot Matrix Core Rotor loader, dark, responsive, keyboard shortcuts |
| Multi-Part Expansion | ✅ | Split chunks >7500 chars auto-expand in search results |

---

## 📊 D1 Database State

```
Chunks:  2231
Vectors:  353 (2048-dim embeddings)
Symbols: 287 (own-repo corpora)
Topics:  ~92
Model:   nvidia/llama-nemotron-embed-vl-1b-v2:free
```

### Topics Indexed (~92)
- **Web stack**: HTML, CSS, jQuery, React (thin), Next.js (thin), Hono, shadcn/ui, shieldcn, Tailwind CSS, NativeWind, bolt.new, RetroUI, Dot Matrix
- **Full-stack (Batch 24)**: TanStack Query (131 chunks, split), Next.js deep (middleware, ISR, routes), React Hook Form, Auth.js v5, TypeScript patterns
- **Backend**: Node.js, Express, FastAPI, Python, tRPC, REST API patterns
- **Cloud/DB**: Cloudflare Workers (full suite), D1, DO, KV, R2, Vectorize, Queues, Workers AI
- **DB**: PostgreSQL, Redis, Prisma, Drizzle ORM (thin), SQLite, Supabase, BigQuery
- **Mobile**: Expo, React Native, Flutter, Dart, Firebase, AWS Amplify
- **Unity (6000.3)**: Base, ECS, Cinemachine, Netcode, Shaders, UI Toolkit, Addressables, ScriptableObjects, Events, Coroutines, Async, Scene Management, Collisions, Joints, Primitives
- **Unity 6000.3 API**: ScriptReference (114 chunks), Manual (32 chunks) — GameObject, Rigidbody, Collider, Camera, Animator, Material, Shader, Mesh, etc.
- **Unity packages**: Package docs (57 chunks, pending import) — Addressables, Cinemachine, Entities, Netcode, Input System
- **Unity animation**: DOTween, LitMotion, PrimeTween
- **DevOps**: GitHub Actions, CI/CD pipelines, Docker, ngrok, Vercel (thin), Wrangler
- **C#/.NET**: LINQ, ZLinq, Dependency Injection, Unit Testing, Data Encryption, System.IO, zlib, filestream, scientific-notation
- **Misc**: TypeScript (thin), Hono, Vitest, MCP SDK, OpenRouter, localization, number formatting, vector math, splines, luminosity, auth patterns
- Own-repo corpora: SCE packages (290), word-guess (423), web-portfolio (155)

### Full-Stack Expansion Plan (Batches 24–28)

**Wave 1 — Batch 24 ✅ DONE**:
| Topic | Chunks | Status |
|-------|--------|--------|
| tanstack-query | 131 | ✅ Done (split into parts) |
| nextjs-deep | 18 | ✅ Done |
| react-hook-form | 11 | ✅ Done |
| nextjs-auth | 3 | ✅ Done |
| ts-patterns | 15 | ✅ Done |

**Wave 2 — Batch 25 (PLANNED)**:
radix-ui, framer-motion, drizzle-deep, playwright, caching-strategies

**Wave 3 — Batch 26 (PLANNED)**:
react-table (TanStack Table), msw, testing-library, eslint-nextjs, sonner

**Wave 4 — Batch 27 (PLANNED)**:
vercel-deep, docker-nextjs, github-actions-nextjs, sentry, cloudflare-pages

**Wave 5 — Batch 28 (PLANNED)**:
socket.io, server-sent-events, nextjs-image, nextjs-fonts, nextjs-metadata

See `knowledge/EXPANSION-ROADMAP.md` for full scope per topic.

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
2. **Show keyword search**: Type "D1 database"
3. **Show search modes**: Click through Keyword → Semantic → Hybrid
4. **Show response times**: Point out ~55ms keyword, semantic search
5. **Show stats**: 85 chunks of Cloudflare Workers documentation

### Key Talking Points
- "2231 chunks of documentation indexed in D1"
- "4 search modes: keyword, semantic, hybrid, AST"
- "Sub-100ms keyword search, semantic search via OpenRouter"
- "Built for AI coding agents as the primary consumer"
- "Edge-deployed on Cloudflare Workers for global low-latency"
- "Multi-part document splitting for long docs (auto-expands in search)"
- "Unity 6000.3 Scripting API + Manual indexed"

---

## 🔜 Next Steps

### Priority 1: Continue Knowledge Base Expansion
- **Import unity-packages-complete** to D1 (57 chunks)
- **Batch 25**: radix-ui, framer-motion, drizzle-deep, playwright, caching-strategies
- **Batch 26**: react-table, msw, testing-library, eslint-nextjs, sonner
- **Batch 27**: vercel-deep, docker-nextjs, github-actions-nextjs, sentry, cloudflare-pages
- **Batch 28**: socket.io, server-sent-events, nextjs-image, nextjs-fonts, nextjs-metadata
- **Unity deepen**: Add more Scripting API classes (Terrain, TextMeshPro, Networking)
- **Unity packages**: TextMeshPro, ProBuilder, Shader Graph, VFX Graph, Timeline, ML-Agents
- **See `knowledge/EXPANSION-ROADMAP.md`** for full details

### Priority 2: Add Symbol Data
1. Index a codebase with AST extraction enabled
2. Export symbols
3. Import to D1

### Priority 3: Polish
- Add loading skeleton animations
- Add search history (localStorage)
- Add result highlighting
- Add pagination for large result sets

---

## 🐛 Known Issues

1. **Low vector count**: Only 207 vectors vs 2085 chunks — most topics have keyword search only; re-embedding needed for full semantic search
2. **wrangler.jsonc interference**: Must use `--config wrangler.toml` when deploying worker from `packages/web/worker/` to avoid picking up parent config
3. **Import batch size**: Reduced to 2 to avoid SQLITE_TOOBIG errors with large chunks

---

## 📝 Notes

- Frontend uses dark theme, responsive design, keyboard shortcuts (`/` to focus search, `Esc` to clear)
- API supports CORS for cross-origin frontend access
- D1 import uses `INSERT OR REPLACE` for idempotent re-imports
- Each vector is ~39KB as JSON (2048 floats), batch size = 2 to stay under D1's ~100KB statement limit
- Cloudflare docs scraper available at `packages/web/cf-scraper.ts`
