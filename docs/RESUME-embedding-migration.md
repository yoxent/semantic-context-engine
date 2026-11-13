# RESUME — Embedding Model Migration

**Last updated**: 2026-11-13 15:20 (UTC+8)
**Repo root**: ✅ **COMPLETE** (2026-11-08) — do not re-index
**web-portfolio**: ✅ **COMPLETE** (2026-11-10) — do not re-index
**packages**: ⏳ **IN PROGRESS** (2026-11-13) — keep the DB, do not delete
**Still outstanding**: finish `packages` + `word-guess` + `knowledge/*` + D1 (needs a decision)
**Next action**: resume `packages` on or after **2026-11-14 08:00 UTC+8**. Do not call the embedding API before then.

---

## Next session

When the user says `continue docs\RESUME-embedding-migration.md`, this section is the assignment. Do the work from this file. Do not re-derive the plan from `HANDOFF.md`.

### Snapshot left by 2026-11-13

```
packages/.sce/metadata.sqlite
  files    = 20   (target 68)
  chunks   = 61   (target 320)
  vectors  = 59   (target 320)
  model    = nvidia/nemotron-3-embed-1b:free x59   (no old-model rows)
  dims     = 2048
  gaps     = core/src/models/Repository.ts  (2 chunks, 0 vectors, NO files row — rollback)
  backup   = packages/.sce/metadata.pre-migration.sqlite  (old model; keep until packages done)
```

The indexer skips any path that already has a matching `files` row. Re-running `reindex-one` continues the remaining ~48 files. Do not wipe. Do not restore the backup.

### Do not

- Re-index `E:\Projects\Indie\semantic-context-engine` (repo root) or `E:\Projects\Web\web-portfolio`. Both are done.
- Touch D1, run `packages/web/import.ts`, or set `SCE_ALLOW_D1_IMPORT=1`. Nobody has chosen option A, B, or C. Continuing this doc is not that choice.
- Run `scripts/index-own-corpora.mjs`. It is the D1 import path.
- Run `scripts/index-knowledge-batch.mjs`. It rewrites every topic's `batchSize` to 1.
- Call the embedding API before **2026-11-14 08:00 UTC+8**. The 2026-11-13 free-tier budget was already spent (account-wide) when this rebuild started. Reset is **2026-11-14 08:00 UTC+8**.
- Delete `packages/.sce/metadata.sqlite`. It is already nemotron-3 with partial progress. Index again; do not wipe.
- Start `word-guess` until `packages` is fully done (exit 0 + verification below).

### Which database

Order is fixed: finish `packages`, then `word-guess`, then `knowledge/*` one topic per day. D1 stays last, and only after the user picks an option in the same message.

| Corpus | Root | Config | Delete the DB first? |
|---|---|---|---|
| `packages` | `E:\Projects\Indie\semantic-context-engine\packages` | `nvidia/nemotron-3-embed-1b:free`, `batchSize` 10 | **No** — already nemotron-3 partial. Keep and resume |
| `word-guess` | `E:\Projects\Indie\word-guess` | Still old model, `batchSize` 1. Change both in the same session as the delete | Yes, only while vectors are still `llama-nemotron-embed-vl-1b-v2` |
| `web-portfolio` | `E:\Projects\Web\web-portfolio` | Done | Never |

Full-corpus dry-run (2026-11-13, zero API calls). Re-run before spending quota; if counts moved, trust the script. The dry-run totals the **whole** corpus; completed `files` rows are skipped at index time, so remaining cost is lower than 78.

| Corpus | Full files / chunks | Full requests @ batch 10 | Remaining (approx) |
|---|---|---|---|
| `packages` | 68 / 320 | 78 | ~48 files left (20 done) — likely fits one 50-req day if the budget is fresh |
| `word-guess` | 107 / 399 | 118 | full rebuild; ~3 quota days — not yet |
| `web-portfolio` | 35 / 157 | 41 | done |

`packages` at batch 10 peaks around 4,200 estimated tokens. Model limit is 32,768. Do not raise `batchSize` past 10.

### Steps for `packages` (current corpus)

Run from `E:\Projects\Indie\semantic-context-engine`.

1. **Quota gate.** If local time is before **2026-11-14 08:00 UTC+8**, or any later day before 08:00 UTC+8 on a day whose budget you already spent, stop. Say when the reset is. Do not delete the packages database. Do not call the API.

2. **Price it** (free, no API):

```powershell
node scripts/plan-index-quota.mjs E:\Projects\Indie\semantic-context-engine\packages
```

3. **Read the database** (free):

```powershell
node -e "const d=require('better-sqlite3')('packages/.sce/metadata.sqlite',{readonly:true}); console.log(d.prepare('select model, count(*) n from vectors group by model').all()); console.log('files', d.prepare('select count(*) n from files').get()); console.log('chunks', d.prepare('select count(*) n from chunks').get()); console.log('vectors', d.prepare('select count(*) n from vectors').get()); d.close()"
```

4. **Branch** — for the current `packages` DB expect the new-model / short-of-target path:

- **New model, files short of dry-run, or any gap** (current state: 20/68, gap on `Repository.ts`): **do not delete**. Go to step 5.
- **New model, files match dry-run, chunks = vectors, NO GAPS**: corpus done. Skip to step 7.
- **Old model** (`llama-nemotron-embed-vl-1b-v2`): should not happen for `packages` anymore. If it does, checkpoint → copy to `metadata.pre-migration.sqlite` → delete `metadata.sqlite` + `-wal` + `-shm`, then index. (`word-guess` still needs this wipe path, and must set `model` + `batchSize` 10 in its `sce.config.json` first.)
- **File missing**: do not restore the backup. Index.

```powershell
# ONLY if vectors are still the OLD model. Do NOT run for the current packages DB.
node -e "const d=require('better-sqlite3')('packages/.sce/metadata.sqlite'); d.pragma('wal_checkpoint(TRUNCATE)'); d.close()"
Copy-Item packages\.sce\metadata.sqlite packages\.sce\metadata.pre-migration.sqlite -Force
Remove-Item packages\.sce\metadata.sqlite, packages\.sce\metadata.sqlite-wal, packages\.sce\metadata.sqlite-shm -ErrorAction SilentlyContinue
```

5. **Index** — the only command that should call the API. Cursor auto-review may block reading `packages/web/.dev.vars`; approve the retry. The script does not print the key and does not import.

```powershell
node scripts/reindex-one.mjs E:\Projects\Indie\semantic-context-engine\packages
```

6. **Verify** after exit 0 (or after a mid-run 429, to record progress):

```powershell
node -e "const d=require('better-sqlite3')('packages/.sce/metadata.sqlite',{readonly:true}); console.log(d.prepare('select model, count(*) n from vectors group by model').all()); console.log('files', d.prepare('select count(*) n from files').get()); console.log('chunks', d.prepare('select count(*) n from chunks').get()); console.log('vectors', d.prepare('select count(*) n from vectors').get()); const g=d.prepare('select c.relative_path p, count(distinct c.id) ch, count(distinct v.chunk_id) v from chunks c left join vectors v on v.chunk_id=c.id group by c.relative_path having v=0 or v<>ch').all(); console.log(g.length?g:'NO GAPS'); d.close()"
```

`packages` is done only when `files=68`, `chunks=vectors=320` (or whatever the dry run just printed), the only model is `nvidia/nemotron-3-embed-1b:free`, and the gap check prints `NO GAPS`. Then one keyword search (free). One semantic search only when the index exited 0 and the corpus is done.

**429 handling:** first-request 429 → budget already gone — stop, delete nothing. Mid-run 429 → normal end of a quota day; in-flight `files` row is rolled back (may leave orphan chunks with 0 vectors, like `Repository.ts`). Re-run `reindex-one` the next day after 08:00 UTC+8. **Do not wipe the nemotron-3 database.**

7. **Write the outcome** into: the status block at the top of this file, the `packages` / `word-guess` row under Still outstanding, and the embedding sentences in `HANDOFF.md` + `HANDOFF-NEXT-TOPICS.md`. Record files, chunks, vectors, model, gaps, and whether the next run must keep the database. The same prompt must work with no other context.

### After `packages`

- If `packages` exited 0 and verified done: start `word-guess` in the same session — edit its `sce.config.json` (`model` → `nvidia/nemotron-3-embed-1b:free`, `batchSize` → 10), then backup / delete its old-model DB, then `node scripts/reindex-one.mjs E:\Projects\Indie\word-guess`.
- If `packages` ended on 429: stop. Do not start `word-guess`, even if counts look close.
- `knowledge/*` starts only after `word-guess` is done, one topic per day, `batchSize` 10 set by hand. Do not use `scripts/index-knowledge-batch.mjs`.
- After `word-guess`, while D1 is undecided: stop and ask the user to pick A, B, or C. Do not pick for them.

---

## TL;DR

The local index for `E:\Projects\Indie\semantic-context-engine` is fully migrated to
`nvidia/nemotron-3-embed-1b:free`. The repo root is not the remaining work. Follow
[Next session](#next-session).

Verified 2026-11-08:

```
files    = 24
chunks   = 393
vectors  = 393
models   = nvidia/nemotron-3-embed-1b:free x393   (no mixing)
dims     = 2048 x393
integrity= ok
FTS rows = 393 == chunks 393
gaps     = NONE — all files fully vectorized
orphans  = 0
```

Keyword, semantic, and hybrid search all return sensible results.

**web-portfolio is migrated too.** Verified 2026-11-10 after a full rebuild:

```
files    = 35
chunks   = 157
vectors  = 157
models   = nvidia/nemotron-3-embed-1b:free x157   (no mixing)
dims     = 2048 x157
integrity= ok
FTS rows = 157 == chunks 157
gaps     = NONE
```

Keyword `"contact form"` hit `components/contact-form.tsx`. Semantic `"where the theme preference is applied"` hit `lib/theme.ts` and `components/theme-preference.tsx`. Backup: `E:\Projects\Web\web-portfolio\.sce\metadata.pre-migration.sqlite`. Its `sce.config.json` model is nemotron-3 and `batchSize` is 10.

The run 429'd once, after 29 stored requests, on `docs/superpowers/specs/2026-07-14-portfolio-design.md` (28 chunks, file row rolled back). Retrying the same index about a minute later finished the corpus. D1 was left unchanged.

**packages is mid-migration.** On 2026-11-13 the old-model DB was checkpointed to
`packages/.sce/metadata.pre-migration.sqlite` and deleted. `scripts/reindex-one.mjs`
wrote **20 files / 61 chunks / 59 vectors** on `nvidia/nemotron-3-embed-1b:free`, then
exited on HTTP 429 (account-wide free-tier budget already spent that day — not a clean
first-request-only failure; some files landed). Gap: `core/src/models/Repository.ts`
(2 chunks, 0 vectors, no `files` row). **Do not delete this DB.** Resume after
**2026-11-14 08:00 UTC+8**. Target remains 68 files / 320 chunks / 320 vectors.

**The remaining work is not a "just run the resume command" job.** D1 needs a decision
between a multi-day full re-embed, deferring, or moving off the free tier. Read
[Still outstanding → 1](#1-d1-migration--deferred-and-the-old-plan-was-unsafe) before
touching D1 — the recipe in the previous version of this doc would have left the
deployed demo silently returning garbage scores.

---

## What changed vs. the original plan

The original resume said "run this and expect ~47 requests". **That number was
stale and would have failed.** Do not use it.

| | Plan | Reality |
|---|---|---|
| Files needing work | 14 | **16** (two more files had changed: `HANDOFF.md`, `HANDOFF-NEXT-TOPICS.md`) |
| Chunks | 200 | **274** |
| Requests at `batchSize: 5` | 47 | **63** — exceeds the entire 50/day budget |
| Requests at `batchSize: 10` | — | **37** — fits |

`batchSize` was raised from 5 to 10 in `sce.config.json` for this reason. Because the
indexer rounds up **per file**, a bigger batch is the only way to fit. Verified safe:

- Worst-case real payload at `batchSize: 10` = 11,670 tokens; model limit is 32,768.
- The API returns vectors in input order (checked across two differently-ordered
  calls), so the provider's positional `data.slice()` mapping is sound.

The run also 429'd once mid-way and resumed cleanly on retry — the `Indexer` rollback
fix did its job (no partial files, no corruption). See "Retry behaviour" below.

---

## Verification commands

All of these are cheap/free and can be re-run any time:

```powershell
node packages/cli/dist/src/main.js stats .
# expect: files=24 chunks=393

node -e "const d=require('better-sqlite3')('.sce/metadata.sqlite',{readonly:true});const q=s=>d.prepare(s).all();console.log(q('select c.relative_path p,count(distinct c.id) ch,count(distinct v.chunk_id) v from chunks c left join vectors v on v.chunk_id=c.id group by c.relative_path having v=0 or v<>ch').length?q('select c.relative_path p,count(distinct c.id) ch,count(distinct v.chunk_id) v from chunks c left join vectors v on v.chunk_id=c.id group by c.relative_path having v=0 or v<>ch'):'NO GAPS');d.close()"
```

Keyword search is free. Semantic/hybrid each cost 1 request:

```powershell
node packages/cli/dist/src/main.js search "hybrid RRF fusion" --path . --limit 2
```

---

## Retry behaviour (added 2026-11-08)

A single transient 429 used to abort an entire indexing run. `OpenAICompatibleEmbeddingProvider`
now retries:

- **Retries**: `429`, `408`, `5xx`, and network-level failures.
- **Fails fast**: `400`/`401`/`404` etc. never succeed on retry.
- **Backoff**: exponential (1s, 2s, 4s… capped at 30s), honouring `Retry-After`.
- **Defaults**: `maxRetries: 3`, `retryDelayMs: 1000`.

Optional config knobs (both optional; provider defaults apply when omitted):

```json
{
  "embedding": {
    "maxRetries": 3,
    "retryDelayMs": 1000
  }
}
```

Note a 429 does **not** consume a retry that damages data — the `Indexer` embeds a file's
full chunk set before `upsert()`, and rolls the `files` row back on failure. Re-running
`index` picks up exactly the unfinished files.

---

## Still outstanding

### 1. D1 migration — deferred, and the old plan was unsafe

**Not the next-session task.** Skip this entire section unless the user names option A, B, or C in the same message. `continue docs\RESUME-embedding-migration.md` does not name one. The commands below delete the published corpus.

**Read this before touching D1.** The previous version of this document gave a
5-step recipe that would have left the deployed demo silently broken. Details below.

#### D1 reality check (verified live 2026-11-08)

D1 is **not** a single-repo database. It holds the whole published corpus:

```
chunks  = 14,417        vectors = 5,313
embedding_config.model = nvidia/llama-nemotron-embed-vl-1b-v2:free   (OLD model)
embedding_config.dimensions = 2048
```

This repo (`5ebbc9b9d0a0e258`) is only one row in that table:

```
repo 5ebbc9b9d0a0e258   chunks = 317   vectors = 146
```

The earlier doc's "chunks = 317 / vectors = 146" was **this repo's** slice, not the
total. Reading it as global state is what makes the recipe dangerous — see the trap.

#### ⚠️ The global-config trap

`embedding_config` is **global**, not per-repository:

```sql
CREATE TABLE IF NOT EXISTS embedding_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

And `npx tsx packages/web/import.ts ...` **always** writes it — even with `--append`:

```
INSERT OR REPLACE INTO embedding_config (key, value) VALUES ('model', '<meta.embeddingModel>')
```

`export` defaults `--model` to `nvidia/nemotron-3-embed-1b:free`, so importing a
fresh local export **automatically flips the global config to the new model**.

`assertVectorModelMatches()` then *passes*, while the ~5,167 old-model vectors belonging
to every other repository are still in the table. `scoreVectorsForIds()` only compares
array lengths, so those repositories return **meaningless cosine scores with no error**.

That is exactly the silent quality regression the guard was added to prevent — flipping
the config without re-embedding everything re-introduces it.

#### The real decision (pick one, do not drift into a half-migration)

| Option | What it means | Cost |
|---|---|---|
| **A. Full D1 re-embed** | Re-embed all 5,313 vectors locally, re-export, re-import | ≈ 21 days of free quota **and** hours of wrangler import time |
| **B. Keep D1 on the old model** | Point the worker at the retired model; D1 breaks when it is retired | 0 today, deferred outage |
| **C. Move the demo off the free tier** | Paid embedding key, or Workers AI / Vectorize | Removes the quota ceiling and the per-vector import bottleneck |

Option A is the only one that fully migrates, and it is much bigger than it looks:
import runs **one `wrangler d1 execute` per vector** (`VECTOR_BATCH_SIZE = 1`, because a
2048-dim vector is ~39 KB and D1 statements cap at 100 KB). At ~2–7s per vector, 5,313
vectors is **~3–10 hours of wall-clock import**, on top of the quota cost.

**The per-repository-only migration (migrate just `5ebbc9b9d0a0e258`) is not available**
unless D1 is simultaneously moved to per-repository model tracking — the global
`embedding_config` cannot express "this repo is new-model, the rest are old-model".

#### If you proceed with Option A

Run wrangler **from `packages/web/worker`** — that is the only directory with the D1
binding (`packages/web/wrangler.jsonc` has none).

```powershell
cd E:\Projects\Indie\semantic-context-engine
node packages/cli/dist/src/main.js export -o sce-export-clean --path .
# ⚠️ `export` reads the LOCAL db and defaults to the new model. It OVERWRITES the
#    existing sce-export-clean/ (which still holds the stale old-model export).
```

Then, from `packages/web/worker`:

```powershell
cd packages\web\worker

# Remove the whole published corpus, not just this repo's slice.
npx wrangler d1 execute sce-db --remote --command "DELETE FROM symbols"
npx wrangler d1 execute sce-db --remote --command "DELETE FROM vectors"
npx wrangler d1 execute sce-db --remote --command "DELETE FROM chunks"

# Import writes embedding_config automatically — no separate step needed.
cd E:\Projects\Indie\semantic-context-engine
npx tsx packages/web/import.ts sce-export-clean sce-db --append
```

There is **no manual `embedding_config` step** — the import performs it. (The previous
version of this doc told you to update it by hand afterwards, which was both redundant
and, if done alone, the trigger for the trap above.)

#### Verify D1 after the run

```powershell
cd packages\web\worker

npx wrangler d1 execute sce-db --remote --command "SELECT COUNT(*) AS c FROM chunks"
npx wrangler d1 execute sce-db --remote --command "SELECT COUNT(*) AS c FROM vectors"
npx wrangler d1 execute sce-db --remote --command "SELECT key, value FROM embedding_config"

# Must be 0 — any rows mean the corpus is mixed-model.
npx wrangler d1 execute sce-db --remote --command "SELECT COUNT(*) AS orphaned FROM vectors v LEFT JOIN chunks c ON c.id = v.chunk_id WHERE c.id IS NULL"
```

Expect `embedding_config.model` to be `nvidia/nemotron-3-embed-1b:free` **and** vectors
to be non-zero and equal to the chunk count you imported. If `model` says nemotron-3 but
`vectors` is far smaller than `chunks`, you have a mixed corpus — go back to the trap
section above.

Finally, re-run the live check (this is the only step that proves it end to end):

```powershell
node packages/cli/dist/src/main.js search "ranking" --path . --mode keyword --limit 2
# then against the deployed API, semantic + hybrid
```

### 2. Other local databases

Measured 2026-11-10 with `node scripts/plan-index-quota.mjs <root>` (discover + chunk, zero API calls). Cost is `Σ ceil(fileChunks / batchSize)` per file. Once `batchSize` is at least the largest file, cost equals the file count and raising it further saves nothing.

| Database | Rebuild files / chunks | Requests at batch 10 | Floor | Status |
|---|---|---|---|---|
| `web-portfolio/.sce` | 35 / 157 | 41 | 35 | ✅ done 2026-11-10 |
| `packages/.sce` | 68 / 320 | **78** | 68 | ⏳ partial 2026-11-13: **20 files / 61 chunks / 59 vectors**, model `nvidia/nemotron-3-embed-1b:free` only, dims 2048. Gap: `core/src/models/Repository.ts` (2 chunks, 0 vectors, no `files` row — rollback). Target still 68/320. Keep DB; resume after 2026-11-14 08:00 UTC+8. Backup: `packages/.sce/metadata.pre-migration.sqlite` |
| `word-guess/.sce` | 107 / 399 | **118** | 107 | old model, 423 vectors. Config still names `llama-nemotron-embed-vl-1b-v2`. Worst batch ~4,300 tokens. Do not start until `packages` is done |
| `knowledge/*/.sce` (265 DBs) | — | — | — | ~5,968 vectors, still old. Multi-week. One topic per day |

A full `packages` rebuild cannot finish in one 50-request day (floor 68). Day 1 (2026-11-13) already landed 20 files, so the remaining ~48 may fit one fresh quota day. The runnable procedure and the keep-the-DB rule are in [Next session](#next-session). Use that section. Do not invent a second procedure from the notes below.

**Deleting just the vectors does not work.** `Indexer` skips any file whose hash matches its `files` row. Delete the whole `metadata.sqlite`, and only when the vectors are still the old model.

---

## Gotchas for the next session

1. **The API key is in `packages/web/.dev.vars`**, not the environment. Index with
   `node scripts/reindex-one.mjs <absolute-corpus-root>` from the repo root. It loads
   the key in-process and does not print it. Cursor's auto-review blocks that read;
   approve the retry when prompted. Do not `Get-Content` the file in the shell.
2. **`batchSize` does not multiply quota** — N chunks in one request costs 1 request.
   But cost is `Σ ceil(fileChunks / batchSize)` **per file**, so raising it genuinely
   helps. 5 → 10 cut this repo from 63 to 37 requests.
3. **Do not run `index` on a database that still has old-model vectors** without
   deleting `.sce/metadata.sqlite` first. The guard will (correctly) throw.
4. **`update` is an alias for `index`** — `SemanticContextEngine.updateRepository()`
   just calls `indexRepository()`.
5. **Recompute the request budget before a big run** with `node scripts/plan-index-quota.mjs <root>`. It chunks the current files and counts **full-corpus** requests. It does not call the API. For a partial nemotron-3 DB, the dry-run total is still the full 78; actual spend is only the unfinished files (`Indexer` skips matching `files` rows). A dry run that embeds against the existing database reports 0 for already-done files — that is the incremental cost, which is what you want when resuming `packages`.
6. **`embedding_config` in D1 is GLOBAL, not per-repository.** Importing any single
   repo's export rewrites the model for the whole database. Never flip it while
   old-model vectors are still present — the guard will pass and the scores will be
   silently meaningless. See the trap section.
7. **Deleting only vectors does not force a re-index.** `Indexer` skips files whose hash
   matches their `files` row, so the `files` table must go too. Delete the whole
   `metadata.sqlite`.
8. **Wrangler D1 commands must run from `packages/web/worker`** — the only directory
   whose config has the D1 binding. `packages/web/wrangler.jsonc` has none.

---

## Backups

- `.sce/metadata.pre-migration.sqlite` — snapshot taken immediately before the
  successful repo-root run (187 vectors). Safe to delete once satisfied.
- `packages/.sce/metadata.pre-migration.sqlite` — old-model snapshot taken 2026-11-13 before the packages rebuild (66 files / 290 chunks / 290 vectors on `llama-nemotron-embed-vl-1b-v2`). Keep until `packages` finishes.
- `E:\Projects\Web\web-portfolio\.sce\metadata.pre-migration.sqlite` — old-model snapshot taken 2026-11-10 before that rebuild (155 chunks / 155 vectors). Safe to delete once satisfied.
- `.sce/metadata.sqlite.bak` — 75.7 MB, **pre-cleanup** (contains 2,778 junk chunks).
- `sce-export-clean/` — ⚠️ **STALE**. Verified 2026-11-08: it still holds the *old-model*
  export (`embeddingModel = nvidia/llama-nemotron-embed-vl-1b-v2:free`, 317 chunks /
  146 vectors, exported 2026-11-07). The D1 recipe's first step regenerates it. Do not
  import it as-is — it would re-import old-model vectors and, via the global-config
  write, mislabel them as new-model. Delete or regenerate before any D1 run.
