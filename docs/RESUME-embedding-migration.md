# RESUME — Embedding Model Migration

**Created**: 2026-11-07 15:38 (UTC+8)
**Blocked on**: OpenRouter free-tier daily quota (resets **2026-11-08 08:00 UTC+8**)
**Scope**: Local index for `E:\Projects\Indie\semantic-context-engine`

---

## TL;DR — what to do next

Wait for the 08:00 reset, then run exactly this:

```powershell
cd E:\Projects\Indie\semantic-context-engine
$key = (Select-String -Path "packages\web\.dev.vars" -Pattern '^OPENROUTER_API_KEY="?([^"]+)?"?').Matches.Groups[1].Value
$env:OPENROUTER_API_KEY = $key
node packages/cli/dist/src/main.js index .
```

Expected: **~47 HTTP requests**, ~200 chunks across **14 files**. Then verify (see below).

⚠️ **Only 3 requests of spare quota.** Batching happens per file, not globally: `Indexer` calls `embed()` once per file, and the provider batches inside that call by `batchSize`. So the real cost is `Σ ceil(fileChunks / 5)` ≈ **47**, not `ceil(200 / 5)` = 40. See "Request cost" below.

**Do not** delete `.sce/metadata.sqlite`. The 187 existing vectors are correct and on the new model. A fresh index would waste the entire day's quota re-embedding everything.

---

## Current state (verified 2026-11-07 15:41)

### Dry-run simulated (2026-11-07 16:00)

I ran the **actual** `IndexingService` against a **copy** of the real database with a stub embedder, so the documented resume was proven without spending quota. Result:

```
BEFORE: { files: 10, chunks: 239, vectors: 187 }
INDEX:  { filesIndexed: 24, chunksIndexed: 200 }
AFTER:  { files: 24, chunks: 387, vectors: 387 }
GAPS REMAINING: NONE
MODELS: nvidia/nemotron-3-embed-1b:free x387   (no mixing)
INTEGRITY: ok
FTS rows: 387 == chunks: 387
```

The real index was **not** modified by this test — it ran on a temp copy.

| Metric | Value |
|---|---|
| Repository ID | `5ebbc9b9d0a0e258` |
| Files tracked | 10 |
| Chunks | 239 |
| Vectors | 187 |
| **Discovered files needing work** | **14** (200 chunks) |
| Model (all 187 vectors) | `nvidia/nemotron-3-embed-1b:free` |
| Dimensions | 2048 |
| Integrity check | ok |
| Orphan vectors | 0 |
| Partial files | **0** |
| FTS rows | 239 (in sync) |

### The 14 files still needing vectors

The previous run aborted early, so it never reached most files. All of these have **no `files` record** — the indexer treats them as new and rebuilds them cleanly. **No manual fix-up needed.**

| File | Chunks (after split) |
|---|---|
| `README.md` | 28 |
| `docs/superpowers/plans/2026-07-13-sce-semantic-search-slice.md` | 24 |
| `docs/superpowers/plans/2026-07-14-sce-web-deployment-slice.md` | 24 |
| `docs/superpowers/plans/2026-07-25-frontend-polish.md` | 11 |
| `docs/superpowers/specs/2026-07-12-sce-interface-first-vertical-design.md` | 16 |
| `docs/superpowers/specs/2026-07-13-sce-ast-symbol-lookup-slice-design.md` | 10 |
| `docs/superpowers/specs/2026-07-13-sce-code-indexing-slice-design.md` | 16 |
| `docs/superpowers/specs/2026-07-13-sce-hybrid-search-slice-design.md` | 13 |
| `docs/superpowers/specs/2026-07-13-sce-semantic-search-slice-design.md` | 13 |
| `docs/superpowers/specs/2026-07-14-sce-web-deployment-slice-design.md` | 29 |
| `fixtures/sample-vault/Agent-Context.md` | 1 |
| `fixtures/sample-vault/Architecture.md` | 2 |
| `fixtures/sample-vault/README.md` | 1 |
| `packages/mcp/README.md` | 12 |
| **Total** | **200** → **47 HTTP requests** |

**Quota budget — tight.** 47 of 50 requests leaves only **3 spare**. If any request 429s, the run stops partway — safely, with no corrupt data. Re-running the next day picks up only what's left, because unfinished files keep no `files` record.

> **Do not run any semantic/hybrid searches that day.** Each one costs 1 free-model request and would eat the 3-request margin. Keyword mode is free and unaffected.

#### Request cost (measured, not estimated)

I simulated the exact run against a copy of the real database with a stub embedder:

```
per-file [requests, chunks] =
  README.md                        [6, 28]
  ...semantic-search-slice.md      [5, 24]
  ...web-deployment-slice.md       [5, 24]
  ...frontend-polish.md            [3, 11]
  ...interface-first-vertical.md   [4, 16]
  ...ast-symbol-lookup-design.md   [2, 10]
  ...code-indexing-design.md       [4, 16]
  ...hybrid-search-design.md       [3, 13]
  ...semantic-search-design.md     [3, 13]
  ...web-deployment-design.md      [6, 29]
  fixtures/sample-vault/*          [1,1] [1,2] [1,1]
  packages/mcp/README.md           [3, 12]
TOTAL: 200 chunks -> 47 requests
```

`ceil(200/5) = 40` is **wrong** — it undercounts by 7 because each file's chunks are rounded up separately (28 chunks = 6 requests, not 5.6).

`**/RESUME-*.md` is now in `sce.config.json` `ignore`, so this handoff file is never indexed. Delete this document once the migration is finished.

### Why there are no partially-vectorized files

`Indexer.ts` embeds a file's entire chunk set before any `upsert()` runs. A failure aborts the whole file and rolls back its `files` record. Files are therefore all-or-nothing — a quota exhaustion cannot leave a document half-searchable.

---

## Why we stopped

`HTTP 429 — free-models-per-day`, account-wide, **50 requests/day across all free models**.

Verified against **both** models — the cap is not per-model, so reverting gains nothing:

```
nemotron-3-embed-1b       b=1  → 429  limit=50 remaining=0
llama-nemotron-embed-vl   b=1  → 429  limit=50 remaining=0
llama-nemotron-embed-vl   b=5  → 429  limit=50 remaining=0
```

Reset timestamp: `1794096000000` → **2026-11-08T00:00:00Z** = 08:00 UTC+8.

---

## Why the model was changed

From `nvidia/llama-nemotron-embed-vl-1b-v2:free` → `nvidia/nemotron-3-embed-1b:free`.

| | Old (llama-nemotron-vl) | New (nemotron-3-embed-1b) |
|---|---|---|
| Dimensions | 2048 | **2048** (compatible) |
| Parameters | ~1.7B | ~1.14B |
| Modality | text + image | text only |
| RTEB 16 (NDCG@10) | 61.98 | **72.38** |
| MMTEB Retrieval | 59.71 | **71.05** |
| Availability | being retired | 100% |

Sources: NVIDIA NIM docs (`Embedding Dimension: 2048`), OpenRouter endpoints API (2048 confirmed live: `HTTP 200, dims=2048`).

**Note**: dimension match does *not* mean old vectors are reusable. `SqliteVectorStore` filters on exact model name, so a model change is always a full re-embed.

---

## Verification after the resume run

```powershell
node packages/cli/dist/src/main.js stats .
```

Expect `files=24 chunks=387`.

Then confirm no gaps remain — this should print `NO GAPS`:

```powershell
node -e "const d=require('better-sqlite3')('.sce/metadata.sqlite',{readonly:true});const r=d.prepare('select c.relative_path p,count(distinct c.id) ch,count(distinct v.chunk_id) v from chunks c left join vectors v on v.chunk_id=c.id group by c.relative_path having v=0 or v<>ch').all();console.log(r.length?r:'NO GAPS — all files fully vectorized');d.close()"
```

Then check search works in both modes:

```powershell
node packages/cli/dist/src/main.js search "hybrid RRF fusion" --path . --limit 2
# semantic mode needs a live key + quota:
node packages/cli/dist/src/main.js search "how does ranking work" --path . --mode semantic --limit 2
```

### When everything is done

Delete this handoff document and its ignore rule:

```powershell
Remove-Item docs\RESUME-embedding-migration.md
# then remove "**/RESUME-*.md" from sce.config.json -> indexing.ignore
```

Keep the ignore pattern if you plan to write future handoffs that shouldn't be indexed; remove it otherwise.

---

## Still outstanding (NOT part of the resume)

### 1. D1 migration — deferred

D1 still holds the **old model** for this repo. Current D1 state:

```
chunks  = 317   (cleaned, junk removed earlier today)
vectors = 146   (old model)
embedding_config.model = nvidia/llama-nemotron-embed-vl-1b-v2:free
```

The worker code now defaults to `nemotron-3-embed-1b`, but a guard I added reads
`embedding_config.model` and throws a clear mismatch error rather than returning
garbage scores. **D1 semantic search will break once the old model is retired.**
Complete migration:

1. Finish the local resume (above)
2. `node packages/cli/dist/src/main.js export -o sce-export-clean --path .`
3. `DELETE FROM vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE repository_id='5ebbc9b9d0a0e258')`
4. `DELETE FROM chunks WHERE repository_id='5ebbc9b9d0a0e258'`
5. `npx tsx packages/web/import.ts sce-export-clean sce-db --append`

⚠️ Step 5 took **~20 minutes for 146 vectors** (one `wrangler d1 execute` per vector,
`VECTOR_BATCH_SIZE = 1`). For a full-corpus D1 re-embed (5,313 vectors) the free
tier is impractical: 5,313 ÷ 5 per request ≈ **1,063 requests ≈ 21 days**.

### 2. Other local databases need rebuilding too

All still carry the old model and will hit the mismatch guard on next `index`:

| Database | Vectors |
|---|---|
| `packages/.sce` | 290 |
| `word-guess/.sce` | 423 |
| `web-portfolio/.sce` | 155 |
| `knowledge/*/.sce` (265 DBs) | ~5,968 total |

### 3. Known operational workarounds

- **Live demo semantic/hybrid is down** during the quota outage (429). **Keyword still works** (verified, 227ms). Use keyword mode until reset.
- **`README.md` stale record was already cleared** — do not re-clear it.

---

## Changes made this session (all committed to working tree, not yet committed to git)

| File | Change |
|---|---|
| `packages/core/src/config/defaults.ts` | Recursive `**/` ignore patterns + Unity/.NET/JS build dirs |
| `packages/indexing/src/FileDiscovery.ts` | Pass `ignore` to `fast-glob` (prunes traversal) |
| `packages/indexing/src/Indexer.ts` | **Roll back `files` record when embedding fails** (was marking files processed before vectors landed → permanently skipped) |
| `packages/storage/src/SqliteStorage.ts` | `migrateSchema()` adds `part_index`/`total_parts` to legacy DBs |
| `packages/web/worker/src/embedding.ts` | New model + exported `VECTOR_MODEL` |
| `packages/web/worker/src/search.ts` | `assertVectorModelMatches()` guard |
| `packages/mcp/src/index.ts`, `packages/cli/src/commands/export.ts`, `scripts/*.mjs` | New model string |
| `sce.config.json`, `packages/sce.config.json` | New model + tighter ignore lists |
| `.gitignore` | `sce-export-*/` |
| `docs/sce-unity.config.example.json` | New Unity template |
| tests (3 files) | +3 regression tests |

**Tests**: 172/172 passing. `npm run build` clean. Worker typechecks.

### Backups

- `.sce/metadata.sqlite.bak` — 75.7 MB, **pre-cleanup** (contains the 2,778 junk chunks). Safe to delete once satisfied.
- `sce-export-clean/` — 317 chunks / 146 vectors, the export used for the D1 import. Gitignored.

---

## Gotchas for the next session

1. **The API key must be loaded from `packages/web/.dev.vars`.** It is not in the environment. Cursor's auto-review may block the extraction command — retry with approval if so.
2. **`batchSize: 5` does not multiply quota** — 5 chunks in one request still costs 1 request. Batching is already optimal; don't "optimise" it.
3. **Do not run `index` on a database that still has old-model vectors** without deleting `.sce/metadata.sqlite` first. The guard will (correctly) throw.
4. **`update` is an alias for `index`** — `SemanticContextEngine.updateRepository()` just calls `indexRepository()`.
