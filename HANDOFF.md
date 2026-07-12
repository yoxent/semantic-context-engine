# Handoff: Semantic Context Engine (SCE) — continue design & first slice

You are continuing a brainstorming/design session. Read and follow the brainstorming skill before any implementation. Do NOT write code until a design is approved, written to a spec, reviewed, and then planned via writing-plans.

## Project root

`E:\Projects\Indie\semantic-context-engine`

## Canonical docs (read first)

- `GOAL.md` — full product vision (retrieval framework for AI agents; NOT "just a vector DB")
- `README.md` — short original positioning (SCE as local-first semantic retrieval for agents)
- Current repo state: essentially greenfield (`GOAL.md`, `README.md`, `LICENSE`, this handoff only)

## Product intent (locked)

SCE is the product. Primary consumer = **AI coding agents** (token economy: retrieve only relevant local context instead of dumping repos / web searching). Secondary consumer = **humans** (presentation, CV/resume showcase) — humans care more about how it's presented than curating content.

Pasttime (`E:\Projects\Web\pasttime`) is **unrelated as an application**. Keep Pasttime 100% game-focused. SCE and Pasttime must **not know each other exist** in code (no shared packages, no imports, no Pasttime routes, no links from Pasttime nav/sitemap).

### Domain borrowing (infra only)

- Pasttime is hosted on **Cloudflare**.
- SCE's public human UI (later) will use a **subdomain** of the same apex domain (obscure name preferred, not `kb`/`wiki`).
- Same Cloudflare **account/DNS** for convenience; **separate Cloudflare Pages/Workers project** (not Pasttime's app).
- Discoverability: no links from Pasttime; `noindex`; URL only if you type it.
- Path-based hosting under Pasttime (`/knowledge`) was **rejected** (couples Pasttime config to SCE).

## Approach (locked): #3 — Interface-first thin vertical

Build the stable skeleton from `GOAL.md`, ship one real retrieval path, leave the rest as replaceable plugins. Optimize for **stability and minimal future refactoring** — "better version from the get-go," not a throwaway prototype.

| Ship in first slice | Interfaces / later |
|---|---|
| Core public API aligned with GOAL (`IndexRepository`, `UpdateRepository`, `Search`, chunk/metadata model, config, DI boundaries) | Semantic search, AST search, hybrid merge |
| Keyword / exact search as the first real strategy | Embedding providers, vector stores, rerankers |
| Knowledge vault (markdown + wiki-links) indexed as a normal repository type | Fancy ranking weights / cross-encoder |
| Local **CLI + MCP** that call the **same** public API | Obsidian-like graph/map/canvas UI |
| Package/module layout matching GOAL (Core, Indexing, Parsing, Retrieval, Embedding, Storage, Ranking, Agent API) | Incremental indexing sophistication beyond what's needed for vault + keyword |
| Tests for the shipped vertical | Full multimodal / cross-repo futures |

First agent surface choice (locked earlier as "C"):  
**Vault as source of truth for curated knowledge + thin local CLI/MCP that searches via SCE API.**  
Public Obsidian-like UI ships later for human/CV consumption of the same vault — still inside SCE, not Pasttime.

## Architecture sketch (approved direction)

```
Agent (Cursor / Claude / Codex / …)
        │
   CLI or MCP  ──►  SCE Public API  ──►  Keyword strategy (implemented)
        │                  │
        │                  ├── Index / chunks / metadata (local store)
        │                  └── Semantic / AST / Hybrid (interfaces only for now)
        │
   Knowledge vault (markdown + [[wiki-links]]) indexed as a repository
```

Later:

```
Human browser ──► Cloudflare Pages (SCE web UI, obscure subdomain)
                      │
                      └── same vault / graph metadata (presentation layer)
```

## Language / stack guidance

Prefer **TypeScript/Node monorepo** for the first vertical (MCP ecosystem, agent tooling, Cloudflare Pages later). Design interfaces so a future core engine language change is possible, but do **not** polyglot on day one unless the approved design requires it. Follow GOAL principles: SOLID, clean architecture, interface-first, plugin architecture, DI, testability, local-first, no required cloud services for agent use.

Reuse proven libraries for low-level pieces (GOAL: don't reinvent ripgrep/tree-sitter/etc. from scratch).

## Explicit non-goals for the first slice

- No Pasttime monorepo integration
- No embeddings/vector DB required to ship v1 agent usefulness
- No full Obsidian UI required in v1
- No building the entire GOAL roadmap before agents can search the vault
- No coupling agent API to UI framework

## Relationship to GOAL.md phases

GOAL asks for phased architecture work (review → architecture → folders → interfaces → storage → retrieval → chunking → ranking → incremental → roadmap). Honor that discipline: **design before implementation**. The first implementation milestone should be the thin vertical above, with folder/interface choices that won't force a rewrite when semantic/AST/hybrid land.

## What to do next in the SCE workspace

1. Read `GOAL.md` + `README.md` + this file + brainstorming skill.
2. Continue design sections with user approval after each:
   - Package/folder structure
   - Core interfaces & data model (chunks, repos, search results)
   - Storage choice for v1 (keep swappable)
   - Keyword retrieval + vault indexing behavior
   - CLI + MCP tool surface
   - Config, ignore rules, logging
   - Later: web UI / Cloudflare subdomain (out of first impl plan unless user expands scope)
   - Testing strategy for the vertical
3. Write approved design to something like:
   `docs/superpowers/specs/YYYY-MM-DD-sce-interface-first-vertical-design.md`
   (create `docs/superpowers/specs/` if needed). Commit the spec in the **SCE** repo when asked / per brainstorming flow.
4. User reviews spec → then invoke **writing-plans** for the first implementation plan.
5. Only then implement.

## Success criteria for "done" design

- Clear module boundaries matching GOAL
- One implemented retrieval strategy + plugin slots for others
- Agents can index a vault/repo and retrieve concise context locally via CLI/MCP
- Path to public graph UI without changing the public API
- Pasttime remains untouched except optional future DNS notes (docs only, not Pasttime code)

## Conversation decisions summary

- Hidden/not-discoverable human site: yes (obscure subdomain, noindex, no Pasttime links)
- Host human UI in SCE project: yes
- Borrow Pasttime domain: DNS/subdomain only
- Hosting: Cloudflare, separate project from Pasttime
- Agent-first, human presentation second: yes
- First slice shape: C (vault + CLI/MCP; UI later)
- Approach: 3 (interface-first thin vertical)
- Work location: **SCE repo only**

## Begin

Confirm you've read `GOAL.md`, `README.md`, and this handoff. Then present the next design section (package/folder structure) for approval. Do not scaffold or implement yet.
