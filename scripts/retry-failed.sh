#!/bin/bash
# Re-run failed topics from the previous batch
# These topics failed due to SQLITE_TOOBIG or ENOENT errors

export OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY packages/web/.dev.vars | cut -d'"' -f2)

FAILED_TOPICS=(
  "github-actions"
  "github-actions-nextjs"
  "google-cloud-thin"
  "hono"
  "html"
  "iap-deep"
  "jquery"
  "kotlin"
  "litmotion"
  "luminosity-formula"
  "monetization-iap"
  "msw"
  "nextjs"
  "nextjs-auth"
  "nextjs-deep"
  "nextjs-fonts"
  "nextjs-metadata"
  "openai-api"
  "openrouter"
  "payment-platforms"
  "playwright"
  "primetween"
  "prisma"
  "radix-ui"
  "react-hook-form"
  "react-table"
  "sonner"
  "socket-io"
  "server-sent-events"
  "sentry-nextjs"
  "cloudflare-pages"
  "docker-nextjs"
  "vercel-deep"
  "drizzle-deep"
  "framer-motion"
  "eslint-nextjs"
  "caching-strategies"
  "radix-themes"
  "design-patterns"
  "testing-library"
  "tanstack-query"
  "ts-patterns"
  "retroui"
  "unity-packages-complete"
  "unity-scripting-api"
  "unity-manual-6000"
  "unity-cloud"
  "unity-ui"
  "unity-networking-deep"
  "unity-postprocessing-package"
  "unity-build-pipeline"
  "unity-test-framework"
  "unity-localization"
  "unity-platform-toolkit"
  "unity-editor-scripting"
  "unity-renderers-lod"
  "unity-camera-advanced"
  "unity-interfaces"
  "unity-v6-features"
  "unity-player-settings"
  "unity-graphics-api"
  "unity-particles-vfx"
  "unity-build-profiles"
  "unity-splines"
  "zlinq"
  "ads-monetization"
  "canva"
  "figma"
  "payment-platforms"
  "radix-themes"
  "bolt"
  "dotmatrix"
  "retroui"
  "unity-splines"
  "unity-networking-deep"
)

SUCCESS=0
FAILED=0

for topic in "${FAILED_TOPICS[@]}"; do
  echo ""
  echo "🔄 Processing: $topic"
  if node scripts/re-index-all.mjs --topic="$topic" 2>&1 | grep -q "✅ $topic complete"; then
    echo "   ✅ Success"
    ((SUCCESS++))
  else
    echo "   ❌ Failed"
    ((FAILED++))
  fi
done

echo ""
echo "📊 Summary:"
echo "   ✅ Success: $SUCCESS"
echo "   ❌ Failed: $FAILED"
