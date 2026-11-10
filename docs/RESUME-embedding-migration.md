# RESUME — Embedding Model Migration

**Last updated**: 2026-11-10 13:10 (UTC+8)
**Repo root**: ✅ **COMPLETE** (2026-11-08) — do not re-index
**web-portfolio**: ✅ **COMPLETE** (2026-11-10) — do not re-index
**Still outstanding**: D1 (needs a decision) + `packages` + `word-guess` + `knowledge/*`
**Next action**: rebuild `packages` on or after **2026-11-11 08:00 UTC+8**. Not on 2026-11-10.

---

## Next session

When the user says `continue docs\RESUME-embedding-migration.md`, this section is the assignment. Do the work from this file. Do not re-derive the plan from `HANDOFF.md`.

### Do not

- Re-index `E:\Projects\Indie\semantic-context-engine` (repo root) or `E:\Projects\Web\web-portfolio`. Both are done.
- Touch D1, run `packages/web/import.ts`, or set `SCE_ALLOW_D1_IMPORT=1`. Nobody has chosen option A, B, or C. Continuing this doc is not that choice.
- Run `scripts/index-own-corpora.mjs`. It is the D1 import path.
- Run `scripts/index-knowledge-batch.mjs`. It rewrites every topic's `batchSize` to 1.
- Call the embedding API on **2026-11-10**. That day's 50 requests were spent finishing web-portfolio (41 index requests, one mid-run 429, then the rest, plus one semantic search). The budget resets **2026-11-11 08:00 UTC+8**. On 2026-11-10, update nothing and stop.
- Delete a `metadata.sqlite` whose vectors are already `nvidia/nemotron-3-embed-1b:free`. That file is partial progress. Index it again.

### Which database

Order is fixed: `packages`, then `word-guess`, then `knowledge/*` one topic per day. D1 stays last, and only after the user picks an option in the same message.

| Corpus | Root | Config | Delete the DB first? |
|---|---|---|---|
| `packages` | `E:\Projects\Indie\semantic-context-engine\packages` | Already `nvidia/nemotron-3-embed-1b:free`, `batchSize` 10 | Only while vectors are still `llama-nemotron-embed-vl-1b-v2` |
| `word-guess` | `E:\Projects\Indie\word-guess` | Still the old model, `batchSize` 1. Change both in the same session as the delete | Same rule |
| `web-portfolio` | `E:\Projects\Web\web-portfolio` | Done | Never |

Measured 2026-11-10 with `node scripts/plan-index-quota.mjs <root>` (zero API calls). Re-run it before spending quota; if the file count moved, trust the script.

| Corpus | Files / chunks | Requests at batch 10 | Floor (one request per file) |
|---|---|---|---|
| `packages` | 68 / 320 | 78 | 68 — two quota days, cannot finish in one |
| `word-guess` | 107 / 399 | 118 | 107 — about three quota days |
| `web-portfolio` | 35 / 157 | 41 | done |

`packages` at batch 10 peaks around 4,200 estimated tokens. The model limit is 32,768. Do not raise `batchSize` past 10 to chase a lower total: the floor is 68.

### Steps for the current corpus

Run these from `E:\Projects\Indie\semantic-context-engine`.

1. If the local time is still 2026-11-10, or any later day before 08:00 UTC+8 on a day whose budget you already spent, stop. Say when the reset is. Do not delete a database.

2. Price it. Expect the table above until the script says otherwise.

```powershell
node scripts/plan-index-quota.mjs E:\Projects\Indie\semantic-context-engine\packages
```

3. Read the database. For `packages`, from the repo root:

```powershell
node -e "const d=require('better-sqlite3')('packages/.sce/metadata.sqlite',{readonly:true}); console.log(d.prepare('select model, count(*) n from vectors group by model').all()); console.log('files', d.prepare('select count(*) n from files').get()); console.log('chunks', d.prepare('select count(*) n from chunks').get()); console.log('vectors', d.prepare('select count(*) n from vectors').get()); d.close()"
```

4. Branch on that output.

- **Old model** (`llama-nemotron-embed-vl-1b-v2`): checkpoint, copy the file to `metadata.pre-migration.sqlite` beside it, then delete `metadata.sqlite`, `metadata.sqlite-wal`, and `metadata.sqlite-shm`. For `word-guess` only, first set `sce.config.json` `model` to `nvidia/nemotron-3-embed-1b:free` and `batchSize` to 10. `packages` is already set.
- **New model, and files are short of the dry-run count, or any file has chunks without matching vectors**: do not delete. The last run stopped on quota. Index again.
- **File missing**: a previous session already deleted it. Do not restore the backup. Index.
- **New model, files match the dry run, chunks = vectors**: that corpus is done. Skip to step 7.

```powershell
node -e "const d=require('better-sqlite3')('packages/.sce/metadata.sqlite'); d.pragma('wal_checkpoint(TRUNCATE)'); d.close()"
Copy-Item packages\.sce\metadata.sqlite packages\.sce\metadata.pre-migration.sqlite -Force
Remove-Item packages\.sce\metadata.sqlite, packages\.sce\metadata.sqlite-wal, packages\.sce\metadata.sqlite-shm -ErrorAction SilentlyContinue
```

Those three commands are for `packages` only. For `word-guess`, use `E:\Projects\Indie\word-guess\.sce\` the same way, and pass that root to `scripts/reindex-one.mjs`.

5. Index. This is the only command that should call the API. Cursor's auto-review may block the read of `packages/web/.dev.vars`. Approve the retry. The script does not print the key and does not import.

```powershell
node scripts/reindex-one.mjs E:\Projects\Indie\semantic-context-engine\packages
```

6. If the process exits 0, verify with the query in step 3 plus a gap check:

```powershell
node -e "const d=require('better-sqlite3')('packages/.sce/metadata.sqlite',{readonly:true}); const g=d.prepare('select c.relative_path p, count(distinct c.id) ch, count(distinct v.chunk_id) v from chunks c left join vectors v on v.chunk_id=c.id group by c.relative_path having v=0 or v<>ch').all(); console.log(g.length?g:'NO GAPS'); d.close()"
```

`packages` is done only when `files=68`, `chunks=vectors=320` (or whatever the dry run just printed), the only model is `nvidia/nemotron-3-embed-1b:free`, and the gap check prints `NO GAPS`. Then run one keyword search (free). Spend one semantic search only when the index exited 0 and the corpus is done.

If the process exits on `HTTP 429` after the provider's own retries: a 429 on the first request means the daily budget is already gone — stop, delete nothing else. A 429 after some files landed is the normal end of a quota day. The in-flight file's `files` row is rolled back. Re-running `scripts/reindex-one.mjs` the next day after 08:00 UTC+8 continues it. Do not wipe the new database.

7. Before you finish, write the outcome into the status block at the top of this file, into the `packages` / `word-guess` row, and into the embedding sentences in `HANDOFF.md` and `HANDOFF-NEXT-TOPICS.md`. Record files, chunks, vectors, model, gaps, and whether the next run must keep the database. The same prompt has to work with no other context.

`word-guess` starts only after `packages` is done. If the `packages` process exited 0, start `word-guess` in the same session (edit its config, then the same backup / delete / `reindex-one` steps, with its own paths). If `packages` ended on a 429, stop even when the counts look finished. `knowledge/*` starts only after `word-guess` is done, one topic per day, with `batchSize` 10 set by hand. Do not use `scripts/index-knowledge-batch.mjs`.

After `word-guess` and while D1 is still undecided, stop and ask the user to pick A, B, or C. Do not pick for them.

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
| `packages/.sce` | 68 / 320 | **78** | 68 | old model, 290 vectors. `packages/sce.config.json` is already nemotron-3, `batchSize: 10`. Worst batch ~4,200 tokens |
| `word-guess/.sce` | 107 / 399 | **118** | 107 | old model, 423 vectors. Config still names `llama-nemotron-embed-vl-1b-v2`. Worst batch ~4,300 tokens |
| `knowledge/*/.sce` (265 DBs) | — | — | — | ~5,968 vectors, still old. Multi-week. One topic per day |

`packages` cannot finish in one 50-request day at any batch size (the floor is 68). It takes two quota days. The runnable procedure, the 2026-11-10 quota stop, and the rule for keeping a half-finished new-model database are in [Next session](#next-session). Use that section. Do not invent a second procedure from the notes below.

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
5. **Recompute the request budget before a big run** with `node scripts/plan-index-quota.mjs <root>`. It chunks the current files and counts requests. It does not call the API. The stale 47-request estimate is how the first attempt was wasted. A dry run that embeds against the existing database reports 0, because unchanged files are skipped — that number is the cost of an incremental update, not of a model rebuild.
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
- `E:\Projects\Web\web-portfolio\.sce\metadata.pre-migration.sqlite` — old-model snapshot taken 2026-11-10 before that rebuild (155 chunks / 155 vectors). Safe to delete once satisfied.
- `.sce/metadata.sqlite.bak` — 75.7 MB, **pre-cleanup** (contains 2,778 junk chunks).
- `sce-export-clean/` — ⚠️ **STALE**. Verified 2026-11-08: it still holds the *old-model*
  export (`embeddingModel = nvidia/llama-nemotron-embed-vl-1b-v2:free`, 317 chunks /
  146 vectors, exported 2026-11-07). The D1 recipe's first step regenerates it. Do not
  import it as-is — it would re-import old-model vectors and, via the global-config
  write, mislabel them as new-model. Delete or regenerate before any D1 run.
