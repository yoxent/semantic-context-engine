#!/bin/bash
# Scrape all knowledge topics

SCE_DIR="E:/Projects/Indie/semantic-context-engine"
SCRAPER="$SCE_DIR/packages/web/cf-scraper.ts"
# Read API key from .dev.vars (source of truth)
OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY "$SCE_DIR/packages/web/.dev.vars" | cut -d'"' -f2)

scrape_topic() {
  local topic=$1
  local urls_file=$2
  local output_dir="$SCE_DIR/knowledge/$topic"
  
  echo "=== Scraping $topic ==="
  npx tsx "$SCRAPER" "$urls_file" "$output_dir" 2>&1 | tail -3
  
  # Index it
  echo "=== Indexing $topic ==="
  cd "$output_dir"
  cat > sce.config.json << 'CONFIGEOF'
{
  "embedding": {
    "provider": "openai-compatible",
    "baseUrl": "https://openrouter.ai/api/v1",
    "model": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    "dimensions": 2048,
    "batchSize": 2,
    "apiKeyEnv": "OPENROUTER_API_KEY"
  },
  "indexing": {
    "include": ["**/*.md"]
  }
}
CONFIGEOF
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" node "$SCE_DIR/packages/cli/dist/src/main.js" index . 2>&1 | tail -1
  cd "$SCE_DIR"
  echo ""
}

# Cloudflare Workers
cat > /tmp/cf-workers-urls.txt << 'EOF'
https://developers.cloudflare.com/workers/
https://developers.cloudflare.com/workers/get-started/
https://developers.cloudflare.com/workers/configuration/
https://developers.cloudflare.com/workers/configuration/environment-variables/
https://developers.cloudflare.com/workers/configuration/secrets/
https://developers.cloudflare.com/workers/configuration/bindings/
https://developers.cloudflare.com/workers/configuration/routing/
https://developers.cloudflare.com/d1/
https://developers.cloudflare.com/d1/get-started/
https://developers.cloudflare.com/d1/configuration/
https://developers.cloudflare.com/d1/worker-api/
https://developers.cloudflare.com/r2/
https://developers.cloudflare.com/r2/get-started/
https://developers.cloudflare.com/kv/
https://developers.cloudflare.com/kv/get-started/
EOF

# Hono
cat > /tmp/hono-urls.txt << 'EOF'
https://hono.dev/
https://hono.dev/docs/getting-started/basic
https://hono.dev/docs/guides/routing
https://hono.dev/docs/guides/middleware
https://hono.dev/docs/api/request
https://hono.dev/docs/api/response
https://hono.dev/docs/api/hono
EOF

# TypeScript
cat > /tmp/typescript-urls.txt << 'EOF'
https://www.typescriptlang.org/docs/handbook/2/generics.html
https://www.typescriptlang.org/docs/handbook/2/utility-types.html
https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
https://www.typescriptlang.org/docs/handbook/2/conditional-types.html
https://www.typescriptlang.org/docs/handbook/2/mapped-types.html
EOF

# Vitest
cat > /tmp/vitest-urls.txt << 'EOF'
https://vitest.dev/
https://vitest.dev/guide/
https://vitest.dev/config/
https://vitest.dev/guide/features.html
https://vitest.dev/guide/cli.html
EOF

# React
cat > /tmp/react-urls.txt << 'EOF'
https://react.dev/learn
https://react.dev/learn/thinking-in-react
https://react.dev/reference/react/hooks
https://react.dev/reference/react/useState
https://react.dev/reference/react/useEffect
https://react.dev/reference/react/useContext
https://react.dev/reference/react/useMemo
https://react.dev/reference/react/useCallback
https://react.dev/reference/react useRef
EOF

# Next.js
cat > /tmp/nextjs-urls.txt << 'EOF'
https://nextjs.org/docs
https://nextjs.org/docs/getting-started
https://nextjs.org/docs/app/building-your-application
https://nextjs.org/docs/app/building-your-application/data-fetching
https://nextjs.org/docs/app/building-your-application/routing
https://nextjs.org/docs/app/building-your-application/rendering
https://nextjs.org/docs/app/api-reference
EOF

# Tailwind CSS
cat > /tmp/tailwind-urls.txt << 'EOF'
https://tailwindcss.com/docs
https://tailwindcss.com/docs/installation
https://tailwindcss.com/docs/utility-first
https://tailwindcss.com/docs/responsive-design
https://tailwindcss.com/docs/hover-focus-and-other-states
EOF

echo "Starting batch scrape..."
echo ""

scrape_topic "cloudflare-workers" "/tmp/cf-workers-urls.txt"
scrape_topic "hono" "/tmp/hono-urls.txt"
scrape_topic "typescript" "/tmp/typescript-urls.txt"
scrape_topic "vitest" "/tmp/vitest-urls.txt"
scrape_topic "react" "/tmp/react-urls.txt"
scrape_topic "nextjs" "/tmp/nextjs-urls.txt"
scrape_topic "tailwind-css" "/tmp/tailwind-urls.txt"

echo "=== Phase 1 complete ==="
echo "Run again for remaining topics..."
