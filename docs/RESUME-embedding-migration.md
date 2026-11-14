# RESUME — Embedding Model Migration

**Last updated**: 2026-11-14 (UTC+8)
**Repo root**: ✅ **COMPLETE** (2026-11-08) — do not re-index
**web-portfolio**: ✅ **COMPLETE** (2026-11-10) — do not re-index
**packages**: ✅ **COMPLETE** (2026-11-14) — do not re-index
**word-guess**: ⏳ **NOT STARTED** — still `llama-nemotron-embed-vl-1b-v2`. Backup, then delete, in the same session as the config change
**Still outstanding**: `word-guess` + `knowledge/*` + D1 (needs a decision)
**Next action**: one owed semantic search on `packages`, then start `word-guess`, on or after **2026-11-15 08:00 UTC+8**. This file is ready for that session. Do not call the embedding API on 2026-11-14. The free-model counter finished at **used 58 / limit 50 / remaining 0**.

---

## Next session

When the user says `continue docs\RESUME-embedding-migration.md`, this section is the assignment. Do the work from this file. Do not re-derive the plan from `HANDOFF.md`.

### Snapshot left by 2026-11-14

`packages` finished on the second run of the day. Do not re-index it.

```
packages/.sce/metadata.sqlite
  files     = 68
  chunks    = 320
  vectors   = 320
  model     = nvidia/nemotron-3-embed-1b:free x320   (no old-model rows)
  dims      = 2048
  integrity = ok
  FTS       = 320 == chunks 320
  gaps      = NONE
  backup    = packages/.sce/metadata.pre-migration.sqlite  (old model; safe to delete once satisfied)
```

Day shape, so the next 429 is not misread:

1. Resumed the partial DB (20 files / 61 chunks / 59 vectors). First `reindex-one` exited 429 after landing **38 files / 154 chunks / 135 vectors**. Gap left behind: `parsing/src/TreeSitterCodeChunker.ts` (19 chunks, 0 vectors, no `files` row).
2. `node scripts/embedding-quota.mjs` then showed **used 21 / limit 50 / remaining 29**. That 429 was a short rate limit, not the daily cap. The provider's three short retries do not cover it.
3. The same `reindex-one` was run again and exited 0 at 68 / 320 / 320, no gaps.
4. The counter then read **used 58 / limit 50 / remaining 0**. An in-flight run can land past the stated 50. The owed semantic search 429'd. Do not start another embedding call on 2026-11-14.

```
word-guess/.sce/metadata.sqlite   (priced 2026-11-14, zero API calls)
  files    = 99
  chunks   = 423
  vectors  = 423
  model    = nvidia/llama-nemotron-embed-vl-1b-v2:free x423
  dims     = 2048
  config   = same old model, batchSize 1
  dry-run  = 107 files / 399 chunks / 118 requests at batch 10
  peak     = ~4,311 tokens (StatsScreen.tsx). Model limit 32,768. Do not raise batchSize past 10.
  backup   = none yet
```

The stored word-guess counts (99 / 423) are the stale index. The dry-run (107 / 399) is the rebuild target. Re-run the dry-run before spending; if it moved, trust the script. Full rebuild is 118 requests, about three quota days. There is no backup until the wipe below.

### Do not

- Re-index `E:\Projects\Indie\semantic-context-engine` (repo root), `E:\Projects\Web\web-portfolio`, or `E:\Projects\Indie\semantic-context-engine\packages`. All three are done.
- Touch D1, run `packages/web/import.ts`, or set `SCE_ALLOW_D1_IMPORT=1`. Nobody has chosen option A, B, or C. Continuing this doc is not that choice.
- Run `scripts/index-own-corpora.mjs`. It is the D1 import path.
- Run `scripts/index-knowledge-batch.mjs`. It rewrites every topic's `batchSize` to 1.
- Call the embeddings API on 2026-11-14, or before 08:00 UTC+8 on any later day. Run `node scripts/embedding-quota.mjs` first on every session from 2026-11-15 on. It does not embed. If it prints `remaining: 0` (exit 2), stop.
- Delete `word-guess/.sce/metadata.sqlite` before its `sce.config.json` edit, or on a day whose counter is already 0. The wipe and the config edit happen in the same session, and only while the vectors are still the old model.
- Start `knowledge/*` until `word-guess` is fully done (exit 0 + the verification below).

### Which database

Order is fixed: `word-guess`, then `knowledge/*` one topic per day. D1 stays last, and only after the user picks an option in the same message.

| Corpus | Root | Config | Delete the DB first? |
|---|---|---|---|
| `packages` | `E:\Projects\Indie\semantic-context-engine\packages` | Done. `nvidia/nemotron-3-embed-1b:free`, `batchSize` 10 | Never |
| `word-guess` | `E:\Projects\Indie\word-guess` | Still old model, `batchSize` 1. Change both in the same session as the delete | Yes, only while vectors are still `llama-nemotron-embed-vl-1b-v2` |
| `web-portfolio` | `E:\Projects\Web\web-portfolio` | Done | Never |

Full-corpus dry-run. `packages` and `web-portfolio` were re-checked by outcome on 2026-11-14 and 2026-11-10. `word-guess` was re-priced 2026-11-14 (zero API calls). Re-run `word-guess` before spending; if counts moved, trust the script. The dry-run totals the **whole** corpus. Once `word-guess` is on nemotron-3, completed `files` rows are skipped, so a resume costs less than 118.

| Corpus | Full files / chunks | Full requests @ batch 10 | Remaining |
|---|---|---|---|
| `packages` | 68 / 320 | 78 | done |
| `word-guess` | 107 / 399 | 118 | full rebuild; ~3 quota days |
| `web-portfolio` | 35 / 157 | 41 | done |

`word-guess` at batch 10 peaks around 4,300 estimated tokens (`src/screens/StatsScreen.tsx`). Model limit is 32,768. Do not raise `batchSize` past 10.

### Steps for `word-guess` (current corpus)

Run from `E:\Projects\Indie\semantic-context-engine`.

1. **Quota gate.** If local time is before **2026-11-15 08:00 UTC+8**, stop. Say when the reset is. Do not edit `word-guess`, do not delete its database, do not call the embeddings API.

   At or after that time, including the 2026-11-15 session, run this before any embeddings call. It does not embed. Exit 2 means `remaining` is 0 — stop the same way. A fresh day should show `remaining` near 50. If it shows 0, that day's budget is already spent; wait until the next 08:00 UTC+8.

```powershell
node scripts/embedding-quota.mjs
```

2. **Owed `packages` semantic search** — one request, only when step 1 shows `remaining` > 0. Keyword already hit `storage/src/SqliteStorage.ts` for `"sqlite vector store"`. This call was skipped on 2026-11-14 because the counter was already at remaining 0.

```powershell
node scripts/search-one.mjs "where embedding failure rolls back the file record" --path E:\Projects\Indie\semantic-context-engine\packages --mode semantic --limit 2
```

   A sensible hit mentions the indexer rollback (expect `indexing/src/Indexer.ts` or the embedding provider). If this 429s, run `embedding-quota.mjs` again. Remaining 0 → stop, and do not touch `word-guess`. Remaining > 0 → wait about 60 seconds and retry this search once. Do not wipe anything because a search failed.

3. **Price `word-guess`** (free, no embeddings API):

```powershell
node scripts/plan-index-quota.mjs E:\Projects\Indie\word-guess
```

4. **Read the database** (free). Expect the old model until the first successful wipe-and-index:

```powershell
node -e "const d=require('better-sqlite3')('E:/Projects/Indie/word-guess/.sce/metadata.sqlite',{readonly:true}); console.log(d.prepare('select model, count(*) n from vectors group by model').all()); console.log('files', d.prepare('select count(*) n from files').get()); console.log('chunks', d.prepare('select count(*) n from chunks').get()); console.log('vectors', d.prepare('select count(*) n from vectors').get()); d.close()"
```

5. **Branch:**

- **Old model** (`llama-nemotron-embed-vl-1b-v2`) — current state. Edit `E:\Projects\Indie\word-guess\sce.config.json` in this same session: `embedding.model` → `nvidia/nemotron-3-embed-1b:free`, `embedding.batchSize` → `10`. Leave `dimensions` at 2048. Then checkpoint, copy the backup, delete the live DB, and go to step 6.
- **New model, files short of the dry-run, or any gap**: a previous day already started the rebuild. **Do not delete.** Do not restore the backup. Go to step 6.
- **New model, files match the dry-run, chunks = vectors, NO GAPS**: corpus done. Skip to step 8.
- **File missing**: do not restore a backup you do not have. Index, after the config names the new model and `batchSize` 10.

```powershell
# ONLY if vectors are still the OLD model. Never run this against a nemotron-3 DB.
node -e "const d=require('better-sqlite3')('E:/Projects/Indie/word-guess/.sce/metadata.sqlite'); d.pragma('wal_checkpoint(TRUNCATE)'); d.close()"
Copy-Item E:\Projects\Indie\word-guess\.sce\metadata.sqlite E:\Projects\Indie\word-guess\.sce\metadata.pre-migration.sqlite -Force
Remove-Item E:\Projects\Indie\word-guess\.sce\metadata.sqlite, E:\Projects\Indie\word-guess\.sce\metadata.sqlite-wal, E:\Projects\Indie\word-guess\.sce\metadata.sqlite-shm -ErrorAction SilentlyContinue
```

6. **Index** — the command that calls the embeddings API. Cursor auto-review may block reading `packages/web/.dev.vars`; approve the retry. The script does not print the key and does not import. This will not finish in one 50-request day.

```powershell
node scripts/reindex-one.mjs E:\Projects\Indie\word-guess
```

7. **Verify** after exit 0, or after a 429, before deciding whether to resume:

```powershell
node -e "const d=require('better-sqlite3')('E:/Projects/Indie/word-guess/.sce/metadata.sqlite',{readonly:true}); console.log(d.prepare('select model, count(*) n from vectors group by model').all()); console.log('files', d.prepare('select count(*) n from files').get()); console.log('chunks', d.prepare('select count(*) n from chunks').get()); console.log('vectors', d.prepare('select count(*) n from vectors').get()); const g=d.prepare('select c.relative_path p, count(distinct c.id) ch, count(distinct v.chunk_id) v from chunks c left join vectors v on v.chunk_id=c.id group by c.relative_path having v=0 or v<>ch').all(); console.log(g.length?g:'NO GAPS'); d.close()"
node scripts/embedding-quota.mjs
```

`word-guess` is done only when `files`, `chunks`, and `vectors` match the dry-run just printed (2026-11-14 target: files=107, chunks=vectors=399), the only model is `nvidia/nemotron-3-embed-1b:free`, and the gap check prints `NO GAPS`. Then one keyword search (free). One semantic search only when that is true and `embedding-quota.mjs` still shows `remaining` > 0.

**429 handling:** run `embedding-quota.mjs` before deciding.

- `remaining` > 0 → short rate limit, same as the first `packages` 429 on 2026-11-14. Wait about 60 seconds, then run `reindex-one` again. Do not wipe. Do not restore the backup.
- `remaining` = 0 → daily budget is spent, even if `used` is a bit over 50 (the `packages` finish landed at 58). Stop. Keep whatever nemotron-3 rows were stored. The in-flight file may be a gap (chunks, 0 vectors, no `files` row). Resume the next day after 08:00 UTC+8. **Do not wipe a nemotron-3 database.**
- 429 on the first request of a day, with no new rows → budget already gone. Stop. If the old DB was already deleted and the new DB has zero vectors, restore `metadata.pre-migration.sqlite` over `metadata.sqlite`. If any nemotron-3 vectors exist, keep the new DB.

8. **Write the outcome** into: the status block at the top of this file, the `word-guess` row under Still outstanding, and the embedding sentences in `HANDOFF.md` + `HANDOFF-NEXT-TOPICS.md`. Record files, chunks, vectors, model, gaps, quota `used`/`remaining`, and whether the next run must keep the database. The same prompt must work with no other context.

### After `word-guess`

- If the run 429'd and `remaining` is 0: stop. Do not start `knowledge/*`.
- `knowledge/*` starts only after `word-guess` is done, one topic per day, `batchSize` 10 set by hand in that topic's `sce.config.json`. Do not use `scripts/index-knowledge-batch.mjs`.
- After `word-guess` is verified done, while D1 is undecided: stop and ask the user to pick A, B, or C. Do not pick for them. Do not start a knowledge topic in that same turn.

---

## TL;DR

Repo root, `web-portfolio`, and `packages` are on `nvidia/nemotron-3-embed-1b:free`.
`word-guess` is the next corpus. Follow [Next session](#next-session).

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

**packages is migrated.** Verified 2026-11-14 after resuming the partial nemotron-3 DB
(do not re-index):

```
files     = 68
chunks    = 320
vectors   = 320
models    = nvidia/nemotron-3-embed-1b:free x320   (no mixing)
dims      = 2048 x320
integrity = ok
FTS rows  = 320 == chunks 320
gaps      = NONE
```

Keyword `"sqlite vector store"` hit `storage/src/SqliteStorage.ts`. Semantic search was
not verified: after the index exited 0, `scripts/embedding-quota.mjs` read **used 58 /
limit 50 / remaining 0**, and the owed semantic query returned HTTP 429. One semantic
search is still owed; it is step 2 of the next session and costs 1 request. Backup:
`packages/.sce/metadata.pre-migration.sqlite` (old model). Safe to delete once satisfied.

The first resume that day 429'd with quota still left (used 21 / remaining 29) after
landing 38 files / 154 chunks / 135 vectors. Waiting and running `reindex-one` again
finished the corpus. A 429 is the end of the day only when `remaining` is 0.

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
| `packages/.sce` | 68 / 320 | **78** | 68 | ✅ done 2026-11-14: **68 files / 320 chunks / 320 vectors**, model `nvidia/nemotron-3-embed-1b:free` only, dims 2048, no gaps, FTS in sync, integrity ok. Keyword verified. Semantic search still owed (1 request) — daily counter was used 58 / remaining 0. Backup: `packages/.sce/metadata.pre-migration.sqlite` |
| `word-guess/.sce` | 107 / 399 | **118** | 107 | old model. Stored DB is stale: **99 files / 423 chunks / 423 vectors** on `llama-nemotron-embed-vl-1b-v2`. Config still names that model, `batchSize` 1. Dry-run 2026-11-14: 107 / 399, worst batch ~4,300 tokens. Next corpus. Do not start before 2026-11-15 08:00 UTC+8 |
| `knowledge/*/.sce` (265 DBs) | — | — | — | ~5,968 vectors, still old. Multi-week. One topic per day |

`packages` finished on 2026-11-14 (the partial nemotron-3 DB was kept and resumed). A full `word-guess` rebuild cannot finish in one 50-request day (floor 107, priced at 118). The runnable procedure is in [Next session](#next-session). Use that section. Do not invent a second procedure from the notes below.

**Deleting just the vectors does not work.** `Indexer` skips any file whose hash matches its `files` row. Delete the whole `metadata.sqlite`, and only when the vectors are still the old model.

---

## Gotchas for the next session

1. **The API key is in `packages/web/.dev.vars`**, not the environment. From the repo root: `node scripts/reindex-one.mjs <absolute-corpus-root>` indexes, `node scripts/search-one.mjs` searches, and `node scripts/embedding-quota.mjs` prints `free_model_daily_requests` without embedding. None of them print the key. Cursor's auto-review blocks the `.dev.vars` read; approve the retry when prompted. Do not `Get-Content` the file in the shell. Inline `node -e` from PowerShell mangles quotes — use these scripts.
2. **`batchSize` does not multiply quota** — N chunks in one request costs 1 request.
   But cost is `Σ ceil(fileChunks / batchSize)` **per file**, so raising it genuinely
   helps. 5 → 10 cut this repo from 63 to 37 requests.
3. **Do not run `index` on a database that still has old-model vectors** without
   deleting `.sce/metadata.sqlite` first. The guard will (correctly) throw.
4. **`update` is an alias for `index`** — `SemanticContextEngine.updateRepository()`
   just calls `indexRepository()`.
5. **Recompute the request budget before a big run** with `node scripts/plan-index-quota.mjs <root>`. It chunks the current files and counts **full-corpus** requests. It does not call the embeddings API. For a partial nemotron-3 DB, the dry-run total is the whole corpus; actual spend is only the unfinished files (`Indexer` skips matching `files` rows).
6. **`embedding_config` in D1 is GLOBAL, not per-repository.** Importing any single
   repo's export rewrites the model for the whole database. Never flip it while
   old-model vectors are still present — the guard will pass and the scores will be
   silently meaningless. See the trap section.
7. **Deleting only vectors does not force a re-index.** `Indexer` skips files whose hash
   matches their `files` row, so the `files` table must go too. Delete the whole
   `metadata.sqlite`.
8. **Wrangler D1 commands must run from `packages/web/worker`** — the only directory
   whose config has the D1 binding. `packages/web/wrangler.jsonc` has none.
9. **A mid-run HTTP 429 is not automatically the end of the day.** On 2026-11-14 the first `packages` resume 429'd after 38 files / 135 vectors while the counter was still used 21 / remaining 29. The provider only retries three short backoffs, which does not cover a one-minute window. Run `node scripts/embedding-quota.mjs`. Remaining > 0 means wait about 60 seconds and run `reindex-one` again. Do not wipe. Remaining 0 means stop. An in-flight run can also land past the stated cap of 50: `packages` finished at used 58 / remaining 0, and the next embedding call 429'd. Do not start another corpus after remaining hits 0.

---

## Backups

- `.sce/metadata.pre-migration.sqlite` — snapshot taken immediately before the
  successful repo-root run (187 vectors). Safe to delete once satisfied.
- `packages/.sce/metadata.pre-migration.sqlite` — old-model snapshot taken 2026-11-13 before the packages rebuild (66 files / 290 chunks / 290 vectors on `llama-nemotron-embed-vl-1b-v2`). `packages` finished 2026-11-14. Safe to delete once satisfied.
- `E:\Projects\Web\web-portfolio\.sce\metadata.pre-migration.sqlite` — old-model snapshot taken 2026-11-10 before that rebuild (155 chunks / 155 vectors). Safe to delete once satisfied.
- `.sce/metadata.sqlite.bak` — 75.7 MB, **pre-cleanup** (contains 2,778 junk chunks).
- `sce-export-clean/` — ⚠️ **STALE**. Verified 2026-11-08: it still holds the *old-model*
  export (`embeddingModel = nvidia/llama-nemotron-embed-vl-1b-v2:free`, 317 chunks /
  146 vectors, exported 2026-11-07). The D1 recipe's first step regenerates it. Do not
  import it as-is — it would re-import old-model vectors and, via the global-config
  write, mislabel them as new-model. Delete or regenerate before any D1 run.
