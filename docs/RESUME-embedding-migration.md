# RESUME — Embedding Model Migration

**Last updated**: 2026-11-08 18:20 (UTC+8)
**Local index**: ✅ **COMPLETE**
**Still outstanding**: D1 migration + other local databases

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

### 1. D1 migration — deferred

D1 still holds the **old model** for this repo. Current D1 state:

```
chunks  = 317   (cleaned, junk removed)
vectors = 146   (old model)
embedding_config.model = nvidia/llama-nemotron-embed-vl-1b-v2:free
```

The worker now defaults to `nemotron-3-embed-1b`, and a guard reads
`embedding_config.model` and throws a clear mismatch error rather than returning
garbage scores. **D1 semantic search will break once the old model is retired.**

Complete migration:

1. `node packages/cli/dist/src/main.js export -o sce-export-clean --path .`
2. `DELETE FROM vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE repository_id='5ebbc9b9d0a0e258')`
3. `DELETE FROM chunks WHERE repository_id='5ebbc9b9d0a0e258'`
4. `npx tsx packages/web/import.ts sce-export-clean sce-db --append`
5. Update `embedding_config.model` in D1.

⚠️ Step 4 took **~20 minutes for 146 vectors** (one `wrangler d1 execute` per vector,
`VECTOR_BATCH_SIZE = 1`). For a full-corpus D1 re-embed (5,313 vectors) the free
tier is impractical: ≈ **1,063 requests ≈ 21 days**.

### 2. Other local databases need rebuilding too

All still carry the old model and will hit the mismatch guard on next `index`:

| Database | Vectors |
|---|---|
| `packages/.sce` | 290 |
| `word-guess/.sce` | 423 |
| `web-portfolio/.sce` | 155 |
| `knowledge/*/.sce` (265 DBs) | ~5,968 total |

Each is a separate full re-embed, and they all share the same 50/day budget. Consider
raising `batchSize` in those configs too (see the per-file rounding note above).

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

---

## Backups

- `.sce/metadata.pre-migration.sqlite` — snapshot taken immediately before the
  successful run (187 vectors). Safe to delete once satisfied.
- `.sce/metadata.sqlite.bak` — 75.7 MB, **pre-cleanup** (contains 2,778 junk chunks).
- `sce-export-clean/` — 317 chunks / 146 vectors, the export used for the D1 import.
