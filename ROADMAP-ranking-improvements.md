# Ranking Improvements — Implementation Plan

**Created**: 2026-07-25
**Status**: Ready to implement
**Estimated time**: 3-4 hours total (4 batches)

---

## Context

The API worker (`packages/web/worker/src/search.ts`) has basic ranking:
- Keyword search: `score = 1.0` (no ranking)
- Semantic search: cosine similarity only
- Hybrid: RRF fusion (k=60)

The local packages have a `SimpleRanker` with filename/heading/identifier boosts, but it's NOT used by the API worker.

**Goal:** Add SimpleRanker + deduplication to the API worker.

---

## Files to Modify

- `packages/web/worker/src/search.ts` — Main search implementation
- `packages/web/worker/src/index.ts` — API endpoints (read-only reference)

---

## Batch 1: Add SimpleRanker to Keyword Search

**Objective:** Keyword results rank by filename/heading matches

**Steps:**

1. Open `packages/web/worker/src/search.ts`

2. Add helper functions at the bottom of the file:
```typescript
// --- Ranking helpers ---

const TERM_RE = /[\p{L}\p{N}_]+/gu;

function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(TERM_RE), (m) => m[0]).filter(Boolean);
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function fileStem(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function applyKeywordBoosts(hits: SearchHit[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  const terms = tokenize(query);

  return hits.map((hit) => {
    let score = hit.score;
    const fileName = fileNameFromPath(hit.relativePath).toLowerCase();
    const stem = fileStem(fileName);
    const snippetLower = hit.text.toLowerCase();
    const headingLower = (hit.headingPath ?? "").toLowerCase();

    // Filename match (+5)
    if (fileName.includes(needle) || stem === needle || terms.some((t) => stem === t || fileName.includes(t))) {
      score += 5;
    }

    // Heading match (+4)
    if (headingLower.includes(needle) || terms.some((t) => headingLower.includes(t))) {
      score += 4;
    }

    // Snippet exact match (+2)
    if (snippetLower.includes(needle)) {
      score += 2;
    }

    return { ...hit, score };
  });
}
```

3. Modify `keywordSearch` function to apply boosts before returning:
```typescript
// At the end of keywordSearch, before return:
return applyKeywordBoosts(results.results.map((row) => ({
  chunkId: row.id as string,
  relativePath: row.relative_path as string,
  headingPath: (row.heading_path as string) ?? null,
  text: String(row.text).substring(0, 500),
  score: row.score as number,
  language: (row.language as string) ?? null,
  partIndex: (row.part_index as number) ?? undefined,
  totalParts: (row.total_parts as number) ?? undefined,
})), query);
```

4. Test:
```bash
curl -s "https://sce-api.pasttime.xyz/api/search?q=Addressables&mode=keyword&limit=5" | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{const d=JSON.parse(Buffer.concat(c));d.hits.forEach((h,i)=>console.log(i+1,h.score.toFixed(2),h.relativePath))})"
```

**Expected:** Filename matches (e.g., `context7-addressables-setup.md`) rank higher

**Checkpoint:** Commit, deploy if desired

---

## Batch 2: Apply SimpleRanker to Semantic Search

**Objective:** Semantic results also get filename/heading boosts

**Steps:**

1. Modify `semanticSearch` function in `search.ts`

2. After getting vectorHits and mapping to SearchHit[], apply the same boosts:
```typescript
// After building baseHits array:
const boosted = applyKeywordBoosts(baseHits, query);
return boosted;
```

3. Test:
```bash
curl -s "https://sce-api.pasttime.xyz/api/search?q=how+to+use+addressables&mode=semantic&limit=5" | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{const d=JSON.parse(Buffer.concat(c));d.hits.forEach((h,i)=>console.log(i+1,h.score.toFixed(4),h.relativePath))})"
```

**Expected:** Filename/heading matches boost semantic results

**Checkpoint:** Commit, deploy if desired

---

## Batch 3: Add Deduplication

**Objective:** Max 2 hits per file to improve result diversity

**Steps:**

1. Add deduplication function to `search.ts`:
```typescript
function deduplicateHits(hits: SearchHit[], maxPerFile: number = 2): SearchHit[] {
  const fileCounts = new Map<string, number>();
  const deduplicated: SearchHit[] = [];

  for (const hit of hits) {
    const count = fileCounts.get(hit.relativePath) ?? 0;
    if (count < maxPerFile) {
      deduplicated.push(hit);
      fileCounts.set(hit.relativePath, count + 1);
    }
  }

  return deduplicated;
}
```

2. Apply in `hybridSearch` after sorting:
```typescript
// After sorted = Array.from(scores.entries())...
const deduped = deduplicateHits(
  sorted.map(([chunkId, score]) => ({ ...allHits.get(chunkId)!, score })),
  2
);
return deduped.slice(0, limit);
```

3. Also apply to keyword and semantic search returns (optional, but recommended)

4. Test:
```bash
curl -s "https://sce-api.pasttime.xyz/api/search?q=Unity&mode=hybrid&limit=10" | node -e "const c=[];process.stdin.on('data',d=>c.push(d));process.stdin.on('end',()=>{const d=JSON.parse(Buffer.concat(c));d.hits.forEach((h,i)=>console.log(i+1,h.relativePath))})"
```

**Expected:** No more than 2 chunks from same file in top 10

**Checkpoint:** Commit, deploy if desired

---

## Batch 4: Final Test + Deploy

**Objective:** Verify everything works, deploy to production

**Steps:**

1. Run full test suite:
```bash
# Test keyword search
curl -s "https://sce-api.pasttime.xyz/api/search?q=Cinemachine&mode=keyword&limit=3"

# Test semantic search
curl -s "https://sce-api.pasttime.xyz/api/search?q=how+to+implement+caching&mode=semantic&limit=3"

# Test hybrid search
curl -s "https://sce-api.pasttime.xyz/api/search?q=D1+transactions&mode=hybrid&limit=5"

# Test deduplication (should see max 2 from same file)
curl -s "https://sce-api.pasttime.xyz/api/search?q=Unity&mode=hybrid&limit=10"
```

2. Deploy:
```bash
cd packages/web/worker
npx wrangler deploy --config wrangler.toml
```

3. Verify live:
```bash
curl -s "https://sce-api.pasttime.xyz/api/search?q=Addressables&mode=keyword&limit=3"
```

4. Update `HANDOFF.md`:
```markdown
## Ranking Improvements
- [x] SimpleRanker added to API worker (filename +5, heading +4, snippet +2)
- [x] Deduplication (max 2 hits per file)
- Deployed: 2026-07-25
```

**Checkpoint:** All done, commit final changes

---

## Rollback Plan

If something breaks after deploy:
```bash
# Revert to previous version
cd packages/web/worker
git checkout -- src/search.ts
npx wrangler deploy --config wrangler.toml
```

---

## Success Criteria

- [ ] Filename matches rank higher in keyword search
- [ ] Heading matches rank higher in keyword search
- [ ] Semantic results also boosted
- [ ] Max 2 chunks per file in results
- [ ] All search modes still work
- [ ] No increase in latency (>500ms)
