# HANDOFF — Semantic Context Engine

**Last Updated**: 2026-07-16
**Status**: Web deployment functional, Cloudflare Workers docs indexed

---

## 🎯 Current State

### Live Demo
- **Frontend**: https://sce-web.pasttime.xyz/
- **API**: https://sce-api.pasttime.xyz/api/
- **D1 Database**: `sce-db` (85 chunks)

### What's Working
| Feature | Status | Notes |
|---------|--------|-------|
| Keyword Search | ✅ | ~55ms response, 85 chunks |
| Semantic Search | ✅ | 81 vectors, Cloudflare docs |
| Hybrid Search | ✅ | Degrades gracefully to keyword-only |
| AST Search | ✅ | 0 symbols (no symbol data) |
| Frontend UI | ✅ | Dark theme, responsive, keyboard shortcuts |

---

## 📊 D1 Database State

```
Chunks:  85 (Cloudflare Workers documentation)
Vectors: 81 (2048-dim embeddings)
Symbols: 0
Model:   nvidia/llama-nemotron-embed-vl-1b-v2:free
```

### Topics Indexed
- D1 (database)
- Durable Objects
- KV
- Queues
- R2
- Vectorize
- Workers AI
- Workers core (runtime, APIs, config)
- Wrangler SDK

---

## 🔧 Configuration

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
- "85 chunks of Cloudflare Workers documentation indexed in D1"
- "4 search modes: keyword, semantic, hybrid, AST"
- "Sub-100ms keyword search, semantic search via OpenRouter"
- "Built for AI coding agents as the primary consumer"
- "Edge-deployed on Cloudflare Workers for global low-latency"

---

## 🔜 Next Steps

### Priority 1: Expand Knowledge Base
- Index more documentation (TypeScript, React, etc.)
- Index your own past projects for pattern reuse

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

1. **No symbols in D1**: AST symbol data not yet exported/imported
2. **wrangler.jsonc interference**: Must use `--config wrangler.toml` when deploying worker from `packages/web/worker/` to avoid picking up parent config
3. **Import batch size**: Reduced to 2 to avoid SQLITE_TOOBIG errors with large chunks

---

## 📝 Notes

- Frontend uses dark theme, responsive design, keyboard shortcuts (`/` to focus search, `Esc` to clear)
- API supports CORS for cross-origin frontend access
- D1 import uses `INSERT OR REPLACE` for idempotent re-imports
- Each vector is ~39KB as JSON (2048 floats), batch size = 2 to stay under D1's ~100KB statement limit
- Cloudflare docs scraper available at `packages/web/cf-scraper.ts`
