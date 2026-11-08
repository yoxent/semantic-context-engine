# RESUME — Embedding Model Migration

**Last updated**: 2026-11-08 18:35 (UTC+8)
**Local index**: ✅ **COMPLETE**
**Still outstanding**: D1 (needs a decision) + other local databases

---

## TL;DR

The local index for `E:\Projects\Indie\semantic-context-engine` is fully migrated to
`nvidia/nemotron-3-embed-1b:free`. Nothing is blocking.

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

### 2. Other local databases need rebuilding too

All still carry the old model and will hit the mismatch guard on next `index`:

| Database | Vectors | Notes |
|---|---|---|
| `packages/.sce` | 290 | config at `packages/sce.config.json` |
| `word-guess/.sce` | 423 | external repo |
| `web-portfolio/.sce` | 155 | external repo |
| `knowledge/*/.sce` (265 DBs) | ~5,968 total | bulk scripts exist |

**Deleting just the vectors does not work.** `Indexer` skips any file whose hash matches
its `files` row, so with `files` intact it never re-embeds. You must delete the whole DB:

```powershell
# per root, e.g. packages/
Remove-Item packages\.sce\metadata.sqlite
cd packages
node ..\packages\cli\dist\src\main.js index .
```

Before each run, **raise `batchSize`** in that root's `sce.config.json` (see the per-file
rounding note above) and **dry-run the cost** — do not guess. `packages/sce.config.json`
currently uses `batchSize: 1`, which would cost ~290 requests for 290 vectors and will
not fit a day's budget.

Suggested order: `packages` (290) → `web-portfolio` (155) → `word-guess` (423) →
`knowledge/*` last. The `knowledge/` set alone is multi-week on the free tier; treat it
as a background chore, one topic per day, and track progress in a list rather than
trying to remember which of 265 topics are done.

Bulk helpers (already handle per-topic configs): `scripts/index-knowledge-batch.mjs`,
`scripts/index-own-corpora.mjs`.

---

## Gotchas for the next session

1. **The API key is in `packages/web/.dev.vars`**, not the environment. Cursor's
   auto-review blocks commands that extract it; approve the retry when prompted.
   `scripts/index-own-corpora.mjs` has the sanctioned loader pattern.
2. **`batchSize` does not multiply quota** — N chunks in one request costs 1 request.
   But cost is `Σ ceil(fileChunks / batchSize)` **per file**, so raising it genuinely
   helps. 5 → 10 cut this repo from 63 to 37 requests.
3. **Do not run `index` on a database that still has old-model vectors** without
   deleting `.sce/metadata.sqlite` first. The guard will (correctly) throw.
4. **`update` is an alias for `index`** — `SemanticContextEngine.updateRepository()`
   just calls `indexRepository()`.
5. **Recompute the request budget before a big run.** The stale 47-request estimate is
   exactly how the first attempt was wasted. A dry run against a copy of the DB with a
   stub embedder costs zero quota and gives the exact number.
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
  successful run (187 vectors). Safe to delete once satisfied.
- `.sce/metadata.sqlite.bak` — 75.7 MB, **pre-cleanup** (contains 2,778 junk chunks).
- `sce-export-clean/` — ⚠️ **STALE**. Verified 2026-11-08: it still holds the *old-model*
  export (`embeddingModel = nvidia/llama-nemotron-embed-vl-1b-v2:free`, 317 chunks /
  146 vectors, exported 2026-11-07). The D1 recipe's first step regenerates it. Do not
  import it as-is — it would re-import old-model vectors and, via the global-config
  write, mislabel them as new-model. Delete or regenerate before any D1 run.
