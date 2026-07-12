# Handoff: Semantic Context Engine (SCE)

## Current state (2026-07-12)

First interface-first vertical is implemented on **`develop`**, plus a small ops polish slice (logging, stats, search filters).

- Branch: `develop` (tracks `origin/develop`)
- `main` is production-only — do not land feature work there yet

## Canonical docs

- `README.md` — how to run the shipped vertical
- `GOAL.md` — long-term vision (still ahead of v1)
- `docs/superpowers/specs/2026-07-12-sce-interface-first-vertical-design.md` — approved design
- `docs/superpowers/plans/2026-07-12-sce-interface-first-vertical.md` — plan that was executed

## Locked product decisions

- SCE is the product; primary consumer = AI coding agents; secondary = human presentation later
- Pasttime is unrelated in code (DNS/subdomain borrowing only, later)
- Approach: interface-first thin vertical
- First agent surface: vault + CLI/MCP on one public API
- Human Obsidian-like UI later inside SCE, not Pasttime

## Shipped in v1 (+ polish)

- Monorepo packages under `packages/`
- Core API + plugin interfaces
- Markdown vault indexing with heading chunks and wiki-link metadata
- SQLite FTS5 keyword search in `.sce/metadata.sqlite`
- Incremental update + deleted-file prune
- `sce.config.json` loaded at runtime
- CLI + MCP adapters sharing `@sce/runtime`
- Structured logging (`createLogger`, `logging.level`, CLI `--verbose`)
- `statistics()` / `sce stats` / `sce_stats`
- Keyword search honors `repositoryIds`, `pathFilter`, `language`

## Known follow-ups

- Better vault ranking (heading-path boosts, etc.)
- Semantic / AST / hybrid strategies (new planned slice)
- Human UI on obscure Cloudflare subdomain

## For the next agent

1. Read `README.md` and the design spec.
2. Work on `develop`, not `main`.
3. Prefer small plans for the next capability slice (ranking, embeddings, or UI).
4. Keep Pasttime untouched.
