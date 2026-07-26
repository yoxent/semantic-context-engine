# Task: Rename ALL URL-based files + Update suggestions

## Context
The SCE knowledge base has 850+ files stored with URL-based filenames (e.g., `https___docs_unity3d_com_...html.md`). These don't benefit from filename search boosts (+5 points). We need to rename ALL of them to descriptive names across ALL topics.

## Scope
- **850+ files** across 50+ topics
- **Topics include:** Unity, Google Cloud, Radix UI, Next.js, Drizzle, React Table, Playwright, TanStack Query, TypeScript, IAP, and many more

## Step 1: Find all URL-based files
```bash
# Count by topic
find knowledge/ -name "https___*" -type f | sed 's|knowledge/||;s|/[^/]*$||' | sort | uniq -c | sort -rn

# List all files
find knowledge/ -name "https___*" -type f | wc -l
```

## Step 2: Create renaming script
Create a script to batch rename files. For each file:
1. Parse the URL from the filename
2. Extract the topic/page name
3. Rename to descriptive name

**Naming conventions:**
- Unity docs: `unity-<topic>.md` (e.g., `unity-addressables.md`)
- Google Cloud: `gcp-<service>.md` (e.g., `gcp-cloud-run.md`)
- Radix UI: `radix-<component>.md` (e.g., `radix-dialog.md`)
- Next.js: `nextjs-<feature>.md` (e.g., `nextjs-app-router.md`)
- Drizzle: `drizzle-<feature>.md` (e.g., `drizzle-migrations.md`)
- Others: `<framework>-<topic>.md`

Use `git mv` to preserve history.

## Step 3: Re-index and update D1
For each modified topic:
```bash
cd knowledge/<topic>
node ../../packages/cli/dist/src/main.js update .
node ../../packages/cli/dist/src/main.js export -o ../../knowledge/<topic>-export --path .
cd ../..
npx tsx packages/web/import.ts knowledge/<topic>-export sce-db --append
```

## Step 4: Update frontend suggestions
Edit `packages/web/frontend/index.html` — update suggestion buttons:
- Use full, non-redundant names
- Cover diverse topics (not just Unity)
- Examples:
  - "Unity Entity Component System" (not "Unity ECS component system")
  - "Google Cloud Run deployment"
  - "Radix UI dialog component"
  - "Next.js app router patterns"

## Step 5: Deploy
```bash
cd packages/web && npx wrangler deploy
```

## Step 6: Commit and update docs
- Commit all changes with descriptive message
- Update `knowledge/INVENTORY.md` with new file names
- Update `HANDOFF.md` with completion status

## Files to modify
- `knowledge/**/*.md` (rename 850+ files)
- `packages/web/frontend/index.html` (suggestions)
- `knowledge/INVENTORY.md` (update)
- `HANDOFF.md` (status update)

## Verification
Test keyword search after changes:
```bash
# Test Unity
curl -s "https://sce-api.pasttime.xyz/api/search?q=Addressables&mode=keyword&limit=5" | jq '.hits[].relativePath'

# Test Google Cloud
curl -s "https://sce-api.pasttime.xyz/api/search?q=Cloud+Run&mode=keyword&limit=5" | jq '.hits[].relativePath'

# Test Radix
curl -s "https://sce-api.pasttime.xyz/api/search?q=Dialog&mode=keyword&limit=5" | jq '.hits[].relativePath'
```
All should show descriptive filenames with boosted scores (12.00).

## Important Notes
- **Preserve git history** — Use `git mv` not `mv`
- **Batch processing** — Process topic by topic to avoid timeouts
- **Test after each topic** — Verify search works before moving to next
- **Update inventory** — Keep `knowledge/INVENTORY.md` in sync
