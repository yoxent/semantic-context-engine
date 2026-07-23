#!/usr/bin/env node
/**
 * Rename URL-based files to descriptive names across all topics
 * Usage: node scripts/rename-url-files.mjs [--dry-run]
 */

import { readdirSync, renameSync, existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const KNOWLEDGE_DIR = 'knowledge';
const DRY_RUN = process.argv.includes('--dry-run');

// Track all renames for reporting
const renames = [];
const errors = [];

/**
 * Convert URL-encoded filename to descriptive name
 * Pattern: https___<domain>_<path>_html.md → descriptive-name.md
 */
function parseUrlFilename(filename) {
  // Remove .md extension
  const base = filename.replace(/\.md$/, '');
  
  // Remove https___ prefix
  if (!base.startsWith('https___')) return null;
  
  const urlPart = base.slice(8); // Remove 'https___'
  
  // Smart URL reconstruction: handle domains vs paths
  // Pattern: domain parts (cloud_google_com) use dots, path parts (api-gateway_docs) use slashes
  // Find common TLDs to identify where domain ends
  const tlds = ['com', 'org', 'net', 'io', 'dev', 'me', 'co'];
  let domainEnd = -1;
  
  for (const tld of tlds) {
    const tldPattern = `_${tld}_`;
    const idx = urlPart.indexOf(tldPattern);
    if (idx !== -1) {
      domainEnd = idx + tld.length + 1; // Include the trailing underscore
      break;
    }
    // Also check at end (no trailing underscore)
    if (urlPart.endsWith(`_${tld}`)) {
      domainEnd = urlPart.length;
      break;
    }
  }
  
  let urlPath;
  if (domainEnd > 0) {
    // Reconstruct domain with dots, path with slashes
    const domainPart = urlPart.slice(0, domainEnd).replace(/_/g, '.');
    const pathPart = urlPart.slice(domainEnd).replace(/_/g, '/');
    urlPath = domainPart + pathPart;
  } else {
    // Fallback: just replace all underscores with slashes
    urlPath = urlPart.replace(/_/g, '/');
  }
  
  return { urlPath, original: filename };
}

/**
 * Extract meaningful name from URL path based on topic
 */
function extractTopicName(urlPath, topic) {
  // Unity Scripting API patterns
  if (topic === 'unity-scripting-api' || urlPath.includes('unity3d.com')) {
    // Match: docs.unity3d.com/6000.3/Documentation/ScriptReference/ClassName.html
    const scriptRefMatch = urlPath.match(/ScriptReference\/(\w+)\.html$/);
    if (scriptRefMatch) {
      return `unity-${scriptRefMatch[1].toLowerCase()}`;
    }
    // Match: docs.unity3d.com/6000.3/Documentation/ScriptReference/ClassName/html
    const scriptRefMatch2 = urlPath.match(/ScriptReference\/(\w+)\/html$/);
    if (scriptRefMatch2) {
      return `unity-${scriptRefMatch2[1].toLowerCase()}`;
    }
    // Match: docs.unity3d.com/6000.3/Documentation/Manual/Topic.html
    const manualMatch = urlPath.match(/Manual\/(\w[\w-]*?)(?:\.html)?$/);
    if (manualMatch) {
      return `unity-${manualMatch[1].toLowerCase()}`;
    }
    // Match: docs.unity3d.com/6000.3/Documentation/Manual/class-ClassName.html
    const classMatch = urlPath.match(/Manual\/class-([\w-]+?)(?:\.html|_html|\/html)$/);
    if (classMatch) {
      return `unity-${classMatch[1].toLowerCase()}`;
    }
    // Match: docs.unity3d.com/Manual/class-ClassName.html
    const classMatch2 = urlPath.match(/Manual\/class-([\w-]+?)(?:\.html|_html|\/html)$/);
    if (classMatch2) {
      return `unity-${classMatch2[1].toLowerCase()}`;
    }
    // Match: Manual/Components.html or Manual/Components/html
    const componentsMatch = urlPath.match(/Manual\/([\w-]+?)(?:\.html|_html|\/html)$/);
    if (componentsMatch) {
      return `unity-${componentsMatch[1].toLowerCase()}`;
    }
  }

  // Unity Manual
  if (topic === 'unity-manual-6000' || urlPath.includes('unity3d.com')) {
    const manualMatch = urlPath.match(/Manual\/(\w[\w-]*?)(?:\.html)?$/);
    if (manualMatch) {
      return `unity-${manualMatch[1].toLowerCase()}`;
    }
    // Match: Manual/class-ClassName.html
    const classMatch = urlPath.match(/Manual\/class-([\w-]+?)_html$/);
    if (classMatch) {
      return `unity-${classMatch[1].toLowerCase()}`;
    }
    // Match: Manual/Components.html
    const componentsMatch = urlPath.match(/Manual\/([\w-]+?)_html$/);
    if (componentsMatch) {
      return `unity-${componentsMatch[1].toLowerCase()}`;
    }
  }

  // Unity Packages
  if (topic === 'unity-packages-complete') {
    // Match: com.unity/packages/package-name/...
    const pkgMatch = urlPath.match(/com\.unity\/[\w-]+\/([\w-]+)/);
    if (pkgMatch) {
      return `unity-${pkgMatch[1].toLowerCase()}`;
    }
    // Match: docs.unity3d.com/Packages/...
    const pkgMatch2 = urlPath.match(/Packages\/[\w.]+\/(\w[\w-]*?)(?:\.html)?$/);
    if (pkgMatch2) {
      return `unity-${pkgMatch2[1].toLowerCase()}`;
    }
  }

  // Google Cloud
  if (topic === 'google-cloud-thin' || urlPath.includes('cloud.google.com')) {
    // Match: cloud.google.com/<service>/docs or cloud.google.com/<service>_docs
    const serviceMatch = urlPath.match(/cloud\.google\.com\/([\w-]+)(?:\/|_)docs/);
    if (serviceMatch) {
      const service = serviceMatch[1];
      // Check for specific sub-pages
      const subpageMatch = urlPath.match(/cloud\.google\.com\/[\w-]+(?:\/|_)docs(?:_|\/)([\w-]+)/);
      if (subpageMatch) {
        return `gcp-${service}-${subpageMatch[1]}`;
      }
      return `gcp-${service}`;
    }
    // Match: cloud.google.com/<service>
    const serviceMatch2 = urlPath.match(/cloud\.google\.com\/([\w-]+)(?:\/|$)/);
    if (serviceMatch2) {
      return `gcp-${serviceMatch2[1]}`;
    }
  }

  // Radix UI
  if (topic === 'radix-ui') {
    const compMatch = urlPath.match(/components\/([\w-]+)/);
    if (compMatch) {
      return `radix-${compMatch[1]}`;
    }
    const primitiveMatch = urlPath.match(/primitives\/([\w-]+)/);
    if (primitiveMatch) {
      return `radix-${primitiveMatch[1]}`;
    }
  }

  // Radix Themes
  if (topic === 'radix-themes') {
    const themeMatch = urlPath.match(/themes\/([\w-]+)/);
    if (themeMatch) {
      return `radix-themes-${themeMatch[1]}`;
    }
    return `radix-themes`;
  }

  // Next.js
  if (topic === 'nextjs-deep' || topic === 'nextjs' || urlPath.includes('nextjs.org')) {
    // Match: nextjs.org/docs/app/...
    const appMatch = urlPath.match(/docs\/app\/([\w-]+)/);
    if (appMatch) {
      return `nextjs-${appMatch[1]}`;
    }
    // Match: nextjs.org/docs/...
    const docsMatch = urlPath.match(/docs\/([\w-]+?)(?:\.html)?$/);
    if (docsMatch) {
      return `nextjs-${docsMatch[1]}`;
    }
    // Match: nextjs.org/docs (generic docs page)
    const genericDocsMatch = urlPath.match(/docs$/);
    if (genericDocsMatch) {
      return 'nextjs-docs';
    }
  }

  // Next.js Image
  if (topic === 'nextjs-image') {
    const imgMatch = urlPath.match(/next\/image.*?\/([\w-]+)/);
    if (imgMatch) {
      return `nextjs-image-${imgMatch[1]}`;
    }
    return 'nextjs-image';
  }

  // Next.js Metadata
  if (topic === 'nextjs-metadata') {
    return 'nextjs-metadata';
  }

  // Next.js Auth
  if (topic === 'nextjs-auth') {
    const authMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (authMatch) {
      return `nextjs-auth-${authMatch[1]}`;
    }
  }

  // Next.js Fonts
  if (topic === 'nextjs-fonts') {
    return 'nextjs-fonts';
  }

  // Drizzle ORM
  if (topic === 'drizzle-orm' || topic === 'drizzle-deep' || topic === 'drizzle-neon' || urlPath.includes('drizzle.team')) {
    const drizzleMatch = urlPath.match(/drizzle\.team\/docs\/([\w-]+)/);
    if (drizzleMatch) {
      return `drizzle-${drizzleMatch[1]}`;
    }
    const drizzleMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (drizzleMatch2) {
      return `drizzle-${drizzleMatch2[1]}`;
    }
  }

  // React Table
  if (topic === 'react-table') {
    const tableMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (tableMatch) {
      return `react-table-${tableMatch[1]}`;
    }
  }

  // Playwright
  if (topic === 'playwright') {
    const playwrightMatch = urlPath.match(/playwright\.dev\/(?:docs\/|api\/)([\w-]+)/);
    if (playwrightMatch) {
      return `playwright-${playwrightMatch[1]}`;
    }
    const playwrightMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (playwrightMatch2) {
      return `playwright-${playwrightMatch2[1]}`;
    }
  }

  // TanStack Query
  if (topic === 'tanstack-query') {
    const queryMatch = urlPath.match(/tanstack\.com\/query\/([\w-]+)/);
    if (queryMatch) {
      return `tanstack-query-${queryMatch[1]}`;
    }
    const queryMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (queryMatch2) {
      return `tanstack-query-${queryMatch2[1]}`;
    }
  }

  // TypeScript
  if (topic === 'ts-patterns' || topic === 'typescript') {
    const tsMatch = urlPath.match(/typescriptlang\.org\/([\w-]+)/);
    if (tsMatch) {
      return `typescript-${tsMatch[1]}`;
    }
    const tsMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (tsMatch2) {
      return `typescript-${tsMatch2[1]}`;
    }
  }

  // React Hook Form
  if (topic === 'react-hook-form') {
    const rhfMatch = urlPath.match(/react-hook-form\.com\/([\w-]+)/);
    if (rhfMatch) {
      return `react-hook-form-${rhfMatch[1]}`;
    }
    const rhfMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (rhfMatch2) {
      return `react-hook-form-${rhfMatch2[1]}`;
    }
  }

  // Shadcn
  if (topic === 'shadcn') {
    const shadcnMatch = urlPath.match(/shadcn\.ui\/([\w-]+)/);
    if (shadcnMatch) {
      return `shadcn-${shadcnMatch[1]}`;
    }
    const shadcnMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (shadcnMatch2) {
      return `shadcn-${shadcnMatch2[1]}`;
    }
  }

  // Framer Motion
  if (topic === 'framer-motion') {
    const framerMatch = urlPath.match(/framer\.com\/([\w-]+)/);
    if (framerMatch) {
      return `framer-motion-${framerMatch[1]}`;
    }
    const framerMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (framerMatch2) {
      return `framer-motion-${framerMatch2[1]}`;
    }
  }

  // Expo
  if (topic === 'expo') {
    const expoMatch = urlPath.match(/expo\.dev\/([\w-]+)/);
    if (expoMatch) {
      return `expo-${expoMatch[1]}`;
    }
    const expoMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (expoMatch2) {
      return `expo-${expoMatch2[1]}`;
    }
  }

  // Firebase
  if (topic === 'firebase') {
    const firebaseMatch = urlPath.match(/firebase\.google\.com\/([\w-]+)/);
    if (firebaseMatch) {
      return `firebase-${firebaseMatch[1]}`;
    }
    const firebaseMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (firebaseMatch2) {
      return `firebase-${firebaseMatch2[1]}`;
    }
  }

  // Socket.io
  if (topic === 'socket-io') {
    const socketMatch = urlPath.match(/socket\.io\/([\w-]+)/);
    if (socketMatch) {
      return `socketio-${socketMatch[1]}`;
    }
    const socketMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (socketMatch2) {
      return `socketio-${socketMatch2[1]}`;
    }
  }

  // Server-Sent Events
  if (topic === 'server-sent-events') {
    const sseMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (sseMatch) {
      return `sse-${sseMatch[1]}`;
    }
  }

  // Caching Strategies
  if (topic === 'caching-strategies') {
    const cacheMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (cacheMatch) {
      return `caching-${cacheMatch[1]}`;
    }
  }

  // Vercel
  if (topic === 'vercel' || topic === 'vercel-deep') {
    const vercelMatch = urlPath.match(/vercel\.com\/([\w-]+)/);
    if (vercelMatch) {
      return `vercel-${vercelMatch[1]}`;
    }
    const vercelMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (vercelMatch2) {
      return `vercel-${vercelMatch2[1]}`;
    }
  }

  // Docker + Next.js
  if (topic === 'docker-nextjs' || topic === 'docker-ngrok') {
    const dockerMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (dockerMatch) {
      return `docker-${dockerMatch[1]}`;
    }
  }

  // GitHub Actions
  if (topic === 'github-actions' || topic === 'github-actions-nextjs') {
    const ghMatch = urlPath.match(/github\.com\/([\w-]+)/);
    if (ghMatch) {
      return `github-actions-${ghMatch[1]}`;
    }
    const ghMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (ghMatch2) {
      return `github-actions-${ghMatch2[1]}`;
    }
  }

  // Sentry
  if (topic === 'sentry-nextjs') {
    const sentryMatch = urlPath.match(/sentry\.io\/([\w-]+)/);
    if (sentryMatch) {
      return `sentry-${sentryMatch[1]}`;
    }
    const sentryMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (sentryMatch2) {
      return `sentry-${sentryMatch2[1]}`;
    }
  }

  // ESLint
  if (topic === 'eslint-nextjs') {
    const eslintMatch = urlPath.match(/eslint\.org\/([\w-]+)/);
    if (eslintMatch) {
      return `eslint-${eslintMatch[1]}`;
    }
    const eslintMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (eslintMatch2) {
      return `eslint-${eslintMatch2[1]}`;
    }
  }

  // React Native
  if (topic === 'react-native') {
    const rnMatch = urlPath.match(/reactnative\.dev\/([\w-]+)/);
    if (rnMatch) {
      return `react-native-${rnMatch[1]}`;
    }
    const rnMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (rnMatch2) {
      return `react-native-${rnMatch2[1]}`;
    }
  }

  // React
  if (topic === 'react') {
    const reactMatch = urlPath.match(/react\.dev\/([\w-]+)/);
    if (reactMatch) {
      return `react-${reactMatch[1]}`;
    }
    const reactMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (reactMatch2) {
      return `react-${reactMatch2[1]}`;
    }
  }

  // Testing Library
  if (topic === 'testing-library') {
    const tlMatch = urlPath.match(/testing-library\.com\/([\w-]+)/);
    if (tlMatch) {
      return `testing-library-${tlMatch[1]}`;
    }
    const tlMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (tlMatch2) {
      return `testing-library-${tlMatch2[1]}`;
    }
  }

  // MSW
  if (topic === 'msw') {
    const mswMatch = urlPath.match(/mswjs\.io\/([\w-]+)/);
    if (mswMatch) {
      return `msw-${mswMatch[1]}`;
    }
    const mswMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (mswMatch2) {
      return `msw-${mswMatch2[1]}`;
    }
  }

  // FastAPI
  if (topic === 'fastapi-python') {
    const fastapiMatch = urlPath.match(/fastapi\.tiangolo\.com\/([\w-]+)/);
    if (fastapiMatch) {
      return `fastapi-${fastapiMatch[1]}`;
    }
    const fastapiMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (fastapiMatch2) {
      return `fastapi-${fastapiMatch2[1]}`;
    }
  }

  // Redis
  if (topic === 'redis') {
    const redisMatch = urlPath.match(/redis\.io\/([\w-]+)/);
    if (redisMatch) {
      return `redis-${redisMatch[1]}`;
    }
    const redisMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (redisMatch2) {
      return `redis-${redisMatch2[1]}`;
    }
  }

  // PostgreSQL
  if (topic === 'postgresql') {
    const pgMatch = urlPath.match(/postgresql\.org\/([\w-]+)/);
    if (pgMatch) {
      return `postgresql-${pgMatch[1]}`;
    }
    const pgMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (pgMatch2) {
      return `postgresql-${pgMatch2[1]}`;
    }
  }

  // SQLite
  if (topic === 'sqlite') {
    const sqliteMatch = urlPath.match(/sqlite\.org\/([\w-]+)/);
    if (sqliteMatch) {
      return `sqlite-${sqliteMatch[1]}`;
    }
    const sqliteMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (sqliteMatch2) {
      return `sqlite-${sqliteMatch2[1]}`;
    }
  }

  // Prisma
  if (topic === 'prisma') {
    const prismaMatch = urlPath.match(/prisma\.io\/([\w-]+)/);
    if (prismaMatch) {
      return `prisma-${prismaMatch[1]}`;
    }
    const prismaMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (prismaMatch2) {
      return `prisma-${prismaMatch2[1]}`;
    }
  }

  // Kotlin
  if (topic === 'kotlin') {
    const kotlinMatch = urlPath.match(/kotlinlang\.org\/([\w-]+)/);
    if (kotlinMatch) {
      return `kotlin-${kotlinMatch[1]}`;
    }
    const kotlinMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (kotlinMatch2) {
      return `kotlin-${kotlinMatch2[1]}`;
    }
  }

  // Hono
  if (topic === 'hono') {
    const honoMatch = urlPath.match(/hono\.dev\/([\w-]+)/);
    if (honoMatch) {
      return `hono-${honoMatch[1]}`;
    }
    const honoMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (honoMatch2) {
      return `hono-${honoMatch2[1]}`;
    }
  }

  // tRPC
  if (topic === 'trpc') {
    const trpcMatch = urlPath.match(/trpc\.io\/([\w-]+)/);
    if (trpcMatch) {
      return `trpc-${trpcMatch[1]}`;
    }
    const trpcMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (trpcMatch2) {
      return `trpc-${trpcMatch2[1]}`;
    }
  }

  // Zod
  if (topic === 'zod') {
    const zodMatch = urlPath.match(/zod\.dev\/([\w-]+)/);
    if (zodMatch) {
      return `zod-${zodMatch[1]}`;
    }
    const zodMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (zodMatch2) {
      return `zod-${zodMatch2[1]}`;
    }
  }

  // C#
  if (topic === 'csharp') {
    const csharpMatch = urlPath.match(/learn\.microsoft\.com\/([\w-]+)/);
    if (csharpMatch) {
      return `csharp-${csharpMatch[1]}`;
    }
    const csharpMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (csharpMatch2) {
      return `csharp-${csharpMatch2[1]}`;
    }
  }

  // C++
  if (topic === 'cpp') {
    const cppMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (cppMatch) {
      return `cpp-${cppMatch[1]}`;
    }
  }

  // Design Patterns
  if (topic === 'design-patterns') {
    const dpMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (dpMatch) {
      return `design-patterns-${dpMatch[1]}`;
    }
  }

  // Scientific Notation
  if (topic === 'scientific-notation') {
    const snMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (snMatch) {
      return `scientific-notation-${snMatch[1]}`;
    }
  }

  // React Native Tooling
  if (topic === 'rn-tooling') {
    const rnToolMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (rnToolMatch) {
      return `rn-tooling-${rnToolMatch[1]}`;
    }
  }

  // Vitest
  if (topic === 'vitest') {
    const vitestMatch = urlPath.match(/vitest\.dev\/([\w-]+)/);
    if (vitestMatch) {
      return `vitest-${vitestMatch[1]}`;
    }
    const vitestMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (vitestMatch2) {
      return `vitest-${vitestMatch2[1]}`;
    }
  }

  // T3 Env
  if (topic === 't3-env') {
    const t3Match = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (t3Match) {
      return `t3-env-${t3Match[1]}`;
    }
  }

  // Pico CSS
  if (topic === 'pico-css') {
    const picoMatch = urlPath.match(/picocss\.com\/([\w-]+)/);
    if (picoMatch) {
      return `pico-${picoMatch[1]}`;
    }
    const picoMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (picoMatch2) {
      return `pico-${picoMatch2[1]}`;
    }
  }

  // MVP CSS
  if (topic === 'mvp-css') {
    const mvpMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (mvpMatch) {
      return `mvp-${mvpMatch[1]}`;
    }
  }

  // OpenRouter
  if (topic === 'openrouter') {
    const orMatch = urlPath.match(/openrouter\.ai\/([\w-]+)/);
    if (orMatch) {
      return `openrouter-${orMatch[1]}`;
    }
    const orMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (orMatch2) {
      return `openrouter-${orMatch2[1]}`;
    }
  }

  // Resend
  if (topic === 'resend') {
    const resendMatch = urlPath.match(/resend\.com\/([\w-]+)/);
    if (resendMatch) {
      return `resend-${resendMatch[1]}`;
    }
    const resendMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (resendMatch2) {
      return `resend-${resendMatch2[1]}`;
    }
  }

  // MCP
  if (topic === 'mcp') {
    const mcpMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (mcpMatch) {
      return `mcp-${mcpMatch[1]}`;
    }
  }

  // Tree-sitter
  if (topic === 'tree-sitter') {
    const tsMatch = urlPath.match(/tree-sitter\.github\.io\/([\w-]+)/);
    if (tsMatch) {
      return `tree-sitter-${tsMatch[1]}`;
    }
    const tsMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (tsMatch2) {
      return `tree-sitter-${tsMatch2[1]}`;
    }
  }

  // Spline
  if (topic === 'spline') {
    const splineMatch = urlPath.match(/spline\.design\/([\w-]+)/);
    if (splineMatch) {
      return `spline-${splineMatch[1]}`;
    }
    const splineMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (splineMatch2) {
      return `spline-${splineMatch2[1]}`;
    }
  }

  // NativeWind
  if (topic === 'nativewind') {
    const nwMatch = urlPath.match(/nativewind\.dev\/([\w-]+)/);
    if (nwMatch) {
      return `nativewind-${nwMatch[1]}`;
    }
    const nwMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (nwMatch2) {
      return `nativewind-${nwMatch2[1]}`;
    }
  }

  // Bolt
  if (topic === 'bolt') {
    const boltMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (boltMatch) {
      return `bolt-${boltMatch[1]}`;
    }
  }

  // Unity specific topics
  if (topic.startsWith('unity-')) {
    const unityMatch = urlPath.match(/unity3d\.com\/[\w.]+\/Documentation\/(?:ScriptReference|Manual)\/([\w-]+)/);
    if (unityMatch) {
      return `unity-${unityMatch[1].toLowerCase()}`;
    }
    const unityMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (unityMatch2) {
      return `unity-${unityMatch2[1].toLowerCase()}`;
    }
  }

  // Play Console
  if (topic === 'play-console') {
    const pcMatch = urlPath.match(/play\.google\.com\/([\w-]+)/);
    if (pcMatch) {
      return `play-console-${pcMatch[1]}`;
    }
    const pcMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (pcMatch2) {
      return `play-console-${pcMatch2[1]}`;
    }
  }

  // Apple GameCenter IAP
  if (topic === 'apple-gamecenter-iap') {
    const appleMatch = urlPath.match(/developer\.apple\.com\/([\w-]+)/);
    if (appleMatch) {
      return `apple-${appleMatch[1]}`;
    }
    const appleMatch2 = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (appleMatch2) {
      return `apple-${appleMatch2[1]}`;
    }
  }

  // Monetization IAP
  if (topic === 'monetization-iap') {
    const iapMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (iapMatch) {
      return `iap-${iapMatch[1]}`;
    }
  }

  // IAP Deep
  if (topic === 'iap-deep') {
    const iapDeepMatch = urlPath.match(/([\w-]+?)(?:\.html)?$/);
    if (iapDeepMatch) {
      return `iap-${iapDeepMatch[1]}`;
    }
  }

  // Generic fallback - extract last meaningful path segment
  const lastSegment = urlPath.split('/').filter(Boolean).pop();
  if (lastSegment) {
    // Clean up the segment
    const cleanName = lastSegment
      .replace(/\.html$/, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    
    if (cleanName && cleanName !== 'docs' && cleanName !== 'html') {
      // Try to determine framework from URL
      let prefix = topic.split('-')[0];
      if (urlPath.includes('github.com')) prefix = 'github';
      else if (urlPath.includes('npmjs.com')) prefix = 'npm';
      else if (urlPath.includes('devdocs.io')) prefix = 'devdocs';
      
      return `${prefix}-${cleanName}`;
    }
  }

  return null;
}

/**
 * Handle duplicate names by appending a number
 */
function handleDuplicate(name, seenNames) {
  if (!seenNames.has(name)) {
    seenNames.add(name);
    return name;
  }
  
  let counter = 2;
  while (seenNames.has(`${name}-${counter}`)) {
    counter++;
  }
  
  const newName = `${name}-${counter}`;
  seenNames.add(newName);
  return newName;
}

/**
 * Process a single topic directory
 */
function processTopic(topicDir) {
  const topicPath = join(KNOWLEDGE_DIR, topicDir);
  
  if (!existsSync(topicPath)) {
    console.log(`⚠️  Topic directory not found: ${topicPath}`);
    return;
  }
  
  const files = readdirSync(topicPath).filter(f => f.startsWith('https___') && f.endsWith('.md'));
  
  if (files.length === 0) {
    return;
  }
  
  console.log(`\n📁 Processing ${topicDir} (${files.length} files)...`);
  
  const seenNames = new Set();
  let renamedCount = 0;
  
  for (const file of files) {
    const parsed = parseUrlFilename(file);
    if (!parsed) {
      console.log(`   ⚠️  Could not parse: ${file}`);
      errors.push({ topic: topicDir, file, error: 'Could not parse URL' });
      continue;
    }
    
    let newName = extractTopicName(parsed.urlPath, topicDir);
    
    if (!newName) {
      // Fallback: use a generic name based on topic
      console.log(`   ⚠️  No pattern match for: ${file}`);
      errors.push({ topic: topicDir, file, error: 'No pattern match' });
      continue;
    }
    
    // Handle duplicates
    newName = handleDuplicate(newName, seenNames);
    newName = `${newName}.md`;
    
    // Skip if same name
    if (newName === file) {
      continue;
    }
    
    const oldPath = join(topicPath, file);
    const newPath = join(topicPath, newName);
    
    renames.push({
      topic: topicDir,
      oldName: file,
      newName,
      oldPath,
      newPath
    });
    
    if (!DRY_RUN) {
      try {
        // Use git mv to preserve history
        execSync(`git mv "${oldPath}" "${newPath}"`, { stdio: 'ignore' });
        renamedCount++;
      } catch (err) {
        // Fallback to regular rename if git mv fails
        try {
          renameSync(oldPath, newPath);
          renamedCount++;
        } catch (renameErr) {
          console.log(`   ❌ Failed to rename: ${file} → ${newName}`);
          errors.push({ topic: topicDir, file, error: renameErr.message });
        }
      }
    } else {
      renamedCount++;
    }
  }
  
  console.log(`   ✅ ${renamedCount} files renamed`);
}

/**
 * Main function
 */
function main() {
  console.log('🔄 Renaming URL-based files to descriptive names...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }
  
  // Get all topic directories (skip files like corpora-index.log)
  const topics = readdirSync(KNOWLEDGE_DIR).filter(item => {
    const itemPath = join(KNOWLEDGE_DIR, item);
    // Must be a directory and not a hidden file
    try {
      const stat = statSync(itemPath);
      if (!stat.isDirectory()) return false;
      return readdirSync(itemPath).some(f => f.startsWith('https___'));
    } catch (e) {
      return false;
    }
  });
  
  console.log(`Found ${topics.length} topics to process`);
  
  for (const topic of topics) {
    processTopic(topic);
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total renames: ${renames.length}`);
  console.log(`   Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const err of errors.slice(0, 10)) {
      console.log(`   ${err.topic}/${err.file}: ${err.error}`);
    }
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`);
    }
  }
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN COMPLETE - No files were modified');
  } else {
    console.log('\n✅ Rename complete!');
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/re-index-all.mjs');
    console.log('2. Run: node scripts/update-suggestions.mjs');
    console.log('3. Deploy: cd packages/web && npx wrangler deploy');
  }
}

main();
