#!/bin/bash
# Re-import all knowledge topics to D1
# Usage: bash scripts/reimport-knowledge-to-d1.sh

set -e

OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY packages/web/.dev.vars | cut -d'"' -f2)
export OPENROUTER_API_KEY

FAILED=()
SUCCESS=()
SKIPPED=()
TOTAL=0
DONE=0

# Collect all topics
TOPICS=()
for d in knowledge/*/; do
  topic=$(basename "$d")
  [ "$topic" = "urls" ] && continue
  [ ! -f "$d.sce/metadata.sqlite" ] && continue
  chunks=$(sqlite3 "$d.sce/metadata.sqlite" "SELECT COUNT(*) FROM chunks;" 2>/dev/null || echo 0)
  [ "$chunks" -eq 0 ] && continue
  TOPICS+=("$topic")
done

TOTAL=${#TOPICS[@]}
echo "=== Re-importing $TOTAL knowledge topics to D1 ==="
echo ""

for topic in "${TOPICS[@]}"; do
  DONE=$((DONE + 1))
  EXPORT_DIR="knowledge/${topic}-export"
  
  # Skip if already exported recently (less than 1 hour old)
  if [ -f "$EXPORT_DIR/meta.json" ] && [ -f "$EXPORT_DIR/chunks.json" ]; then
    AGE=$(( $(date +%s) - $(stat -c %Y "$EXPORT_DIR/meta.json" 2>/dev/null || stat -f %m "$EXPORT_DIR/meta.json" 2>/dev/null || echo 0) ))
    if [ "$AGE" -lt 3600 ]; then
      echo "[$DONE/$TOTAL] $topic — export exists (${AGE}s old), importing..."
      if npx tsx packages/web/import.ts "$EXPORT_DIR" sce-db --append 2>&1 | tail -3; then
        SUCCESS+=("$topic")
        echo "  ✅ Done"
      else
        FAILED+=("$topic")
        echo "  ❌ Import failed"
      fi
      echo ""
      continue
    fi
  fi
  
  echo "[$DONE/$TOTAL] $topic — exporting..."
  
  # Export
  if ! node packages/cli/dist/src/main.js export --path "knowledge/$topic" -o "$EXPORT_DIR" 2>&1 | tail -2; then
    FAILED+=("$topic")
    echo "  ❌ Export failed, skipping"
    echo ""
    continue
  fi
  
  # Verify export has data
  if [ ! -f "$EXPORT_DIR/chunks.json" ]; then
    FAILED+=("$topic")
    echo "  ❌ No chunks.json produced, skipping"
    echo ""
    continue
  fi
  
  CHUNK_COUNT=$(node -e "console.log(require('./$EXPORT_DIR/chunks.json').length)" 2>/dev/null || echo 0)
  if [ "$CHUNK_COUNT" -eq 0 ]; then
    SKIPPED+=("$topic")
    echo "  ⏭️  0 chunks, skipping"
    echo ""
    continue
  fi
  
  echo "  Exported $CHUNK_COUNT chunks, importing..."
  
  # Import with append
  if npx tsx packages/web/import.ts "$EXPORT_DIR" sce-db --append 2>&1 | tail -3; then
    SUCCESS+=("$topic")
    echo "  ✅ Done"
  else
    FAILED+=("$topic")
    echo "  ❌ Import failed"
  fi
  echo ""
done

echo "=== Summary ==="
echo "Total:   $TOTAL"
echo "Success: ${#SUCCESS[@]}"
echo "Failed:  ${#FAILED[@]}"
echo "Skipped: ${#SKIPPED[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "Failed topics:"
  for t in "${FAILED[@]}"; do echo "  - $t"; done
fi
if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo ""
  echo "Skipped topics:"
  for t in "${SKIPPED[@]}"; do echo "  - $t"; done
fi
