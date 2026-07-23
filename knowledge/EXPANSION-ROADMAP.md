# Knowledge Base Expansion Roadmap

**Created**: 2026-07-18
**Last Updated**: 2026-07-21
**Total Topics Planned**: ~100+
**Status**: Active indexing

---

## Current State

- **D1 Live**: ~5532 chunks, ~3019 vectors, ~137 topics
- **Indexed**: All batches 1–35, Unity packages (all planned batches complete)
- **Pending**: None
- **Multi-part splitting**: Enabled for chunks >7500 chars; search API expands all parts of matched documents

---

## ✅ Completed Batches

| Batch | Topics | Status |
|-------|--------|--------|
| 1 | Expo, Firebase, GCP thin, RN, Kotlin, IAP, Play Console, Game Center, RN tooling | ✅ Done |
| 2 | Tailwind v4, Resend, Vercel, t3-env, Zod, Drizzle+Neon, FastAPI, Docker, ngrok | ✅ Done |
| 3 | Wrangler, OpenRouter, MCP, SQLite deepen, own-repo corpora | ✅ Done |
| 4 | shadcn, NativeWind, GitHub Actions, Unity Netcode, Unity Shaders, Unity ECS deepen, Unity Cinemachine deepen | ✅ Done |
| 5 | shieldcn, bolt.new | ✅ Done |
| 6 | REST API, Flutter, Dart, Supabase, AWS Amplify, Node.js, Express, HTML, CSS, jQuery, BigQuery, CI/CD, Object Pooling, Vector Math, Spline, LINQ/ZLinq, DI, Unity ScriptableObjects, Number Formatting, Localization, Unity Events, Coroutines, Async/Awaitables, Unit Testing, Scene Management, DOTween, LitMotion, PrimeTween, zlib, Data Encryption, System.IO, Luminosity, Auth Patterns | ✅ Done |
| 7 | RetroUI (neobrutalist React components) | ✅ Done |
| 8 | Dot Matrix (loading animations) | ✅ Done |
| 9 | filestream, scientific-notation | ✅ Done |
| 14 | Unity Collisions (colliders, triggers, raycasting) | ✅ Done |
| 15 | Unity Joints (springs, vehicle suspension, ragdoll) | ✅ Done |
| 16 | Unity Primitives (mesh API, procedural generation) | ✅ Done |
| 10 | Particle Systems, VFX Graph | ✅ Done |
| 11 | Post-Processing, Decals, Fog | ✅ Done |
| 12 | Build Profiles, Build Automation | ✅ Done |
| 13 | Unity 6 Features (GPU Resident Drawer, Sentis ML) | ✅ Done |
| 17 | Renderers, GPU Instancing, LOD, Occlusion | ✅ Done |
| 18 | Camera, Cinemachine Advanced | ✅ Done |
| 20 | Interfaces (IPointer, IDrag, EventSystem, Input System) | ✅ Done |
| 21 | Editor Scripting, Custom Inspectors | ✅ Done |
| 22 | Player Settings, Quality Settings | ✅ Done |
| 23 | Graphics API, CommandBuffer, Compute Shaders | ✅ Done |
| 24 | tanstack-query, nextjs-deep, react-hook-form, nextjs-auth, ts-patterns | ✅ Done |
| 25 | radix-ui (303), framer-motion (49), drizzle-deep (37), playwright (55), caching-strategies (51) | ✅ **Imported to D1** |
| Unity+ | unity-scripting-api (114 chunks), unity-manual-6000 (32 chunks) | ✅ Done |
| Unity++ | unity-packages-complete (57 chunks) — Addressables, Cinemachine, Netcode, Input System | ⚠️ Scraped, needs import |
| 32 | pico-css, watercss, mvp-css, new-css, radix-themes | ✅ Done |
| 33 | zlinq (deep scrape from GitHub) | ✅ Done |
| 34 | iap-deep, ads-monetization, unity-networking-deep, figma, canva, payment-platforms | ✅ **Imported to D1** |
| 35 | retroui (124 chunks), unity-splines-deep (25 chunks) | ✅ **Imported to D1** |
| 36 | unity-postprocessing-package (34), unity-build-pipeline (32), unity-test-framework (39), unity-ui-test-framework (25), unity-localization (58), unity-platform-toolkit (34) | ✅ **Imported to D1** |
| 26 | react-table (89), msw (35), testing-library (45), eslint-nextjs (25), sonner (32) | ✅ **Imported to D1** |
| 27 | vercel-deep (39), docker-nextjs (202), github-actions-nextjs (69), sentry-nextjs (57), cloudflare-pages (81) | ✅ **Imported to D1** |
| 28 | socket-io (58), server-sent-events (35), nextjs-image (74), nextjs-fonts (32), nextjs-metadata (40) | ✅ **Imported to D1** |

---

## ✅ Batch 24 — Full-Stack React/Next.js — Foundation (Wave 1) — DONE

**Priority**: HIGH — Biggest gaps in the knowledge base
**Status**: ✅ Indexed and imported to D1 (131 + 18 + 11 + 3 + 15 = 178 chunks)
**Note**: Uses chunk splitting for documents >7500 chars; search API auto-expands multi-part results

| Topic | Scope | Source |
|-------|-------|--------|
| `tanstack-query` | QueryClient, useQuery, useMutation, useInfiniteQuery, cache invalidation, optimistic updates, stale-while-revalidate, pagination, infinite scroll, prefetching, mutations, devtools | Context7 + tanstack.com |
| `nextjs-deep` | Middleware (redirects, rewrites, A/B testing, geolocation), ISR, on-demand revalidation, `revalidateTag`, `revalidatePath`, parallel routes `@slot`, intercepting routes `(.)`, route groups, loading.tsx, streaming Suspense, `after()` API, Partial Prerendering | Context7 + nextjs.org |
| `react-hook-form` | useForm, useFieldArray, validation (Zod/yup resolver), controller, watch, formState, defaultValues, dynamic fields, conditional validation, perf comparison with controlled components | Context7 + react-hook-form.com |
| `nextjs-auth` (Auth.js v5) | NextAuth config, Credentials/Google/GitHub providers, session strategies (JWT vs database), callbacks (jwt, session, signIn), middleware protection, Server Components auth, `auth()` helper, RBAC, refresh tokens, account linking | Context7 + authjs.dev |
| `ts-patterns` | Discriminated unions, type narrowing with `satisfies`, const assertions, exhaustive switch, branded/nominal types, template literal types, `infer` in practice, Result/Either pattern, never type for unreachable code, deep readonly, type-safe event emitters | Context7 + TypeScript handbook |

### URL Sources
```
https://tanstack.com/query/latest
https://tanstack.com/query/latest/docs/framework/react/overview
https://tanstack.com/query/latest/docs/framework/react/guides/queries
https://tanstack.com/query/latest/docs/framework/react/guides/mutations
https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries
https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries
https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
https://tanstack.com/query/latest/docs/framework/react/guides/prefetching
https://nextjs.org/docs/app/building-your-application/routing/middleware
https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes
https://nextjs.org/docs/app/building-your-application/routing/parallel-routes
https://nextjs.org/docs/app/building-your-application/routing/route-groups
https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering
https://nextjs.org/docs/app/building-your-application/rendering/streaming
https://nextjs.org/docs/app/api-reference/functions/revalidateTag
https://nextjs.org/docs/app/api-reference/functions/revalidatePath
https://nextjs.org/docs/app/api-reference/functions/after
https://react-hook-form.com/
https://react-hook-form.com/get-started
https://react-hook-form.com/useform
https://react-hook-form.com/usefieldarray
https://react-hook-form.com/faqs
https://next.authjs.dev/
https://next.authjs.dev/getting-started/installation
https://next.authjs.dev/getting-started/providers
https://next.authjs.dev/getting-started/session-management/protecting
https://next.authjs.dev/getting-started/session-management/callbacks
https://next.authjs.dev/resources/application-router
```

---

## ✅ Batch 25 — Full-Stack React/Next.js — UI & Polish (Wave 2) — DONE

**Priority**: MEDIUM — Component libraries and UX patterns
**Status**: ✅ Indexed and imported to D1 (303 + 49 + 37 + 55 + 51 = 495 chunks)
**Actual chunks**: 495 (higher than estimated due to Radix UI's extensive component docs)

| Topic | Scope | Source |
|-------|-------|--------|
| `radix-ui` | Primitives architecture, Dialog, Popover, Tooltip, Select, DropdownMenu, Tabs, Accordion, NavigationMenu, ContextMenu, RadioGroup, Switch, Toggle — headless, accessible, composable | Context7 + radix-ui.com |
| `framer-motion` | Motion components, layout animations, AnimatePresence, variants, gestures (drag, hover, tap), scroll animations, shared layout, springs, keyframes, useMotionValue, useTransform, motion div | Context7 + motion.dev |
| `drizzle-deep` | Relations (one/many/many-to-many), joins (inner, left, subquery), transactions (batch, interactive), relational query builder, `$with`, `$using`, subqueries, performance tips, connection pooling, migrations (drizzle-kit push vs generate) | Context7 + orm.drizzle.team |
| `playwright` | Browser context, fixtures, page objects, locators (role, text, CSS), assertions, network mocking, trace viewer, codegen, parallel testing, CI setup (GitHub Actions), visual comparison, auth state | Context7 + playwright.dev |
| `caching-strategies` | Next.js fetch cache (`cache: 'force-cache'` / `'no-store'`), `unstable_cache`, `unstable_noStore`, ISR vs on-demand revalidation, stale-while-revalidate headers, CDN caching, Edge caching, Redis cache layer, cache tags, cache invalidation patterns | Next.js docs + blog |

### URL Sources
```
https://www.radix-ui.com/primitives/docs/overview/getting-started
https://www.radix-ui.com/primitives/docs/components/dialog
https://www.radix-ui.com/primitives/docs/components/popover
https://www.radix-ui.com/primitives/docs/components/tooltip
https://www.radix-ui.com/primitives/docs/components/select
https://www.radix-ui.com/primitives/docs/components/dropdown-menu
https://www.radix-ui.com/primitives/docs/components/tabs
https://www.radix-ui.com/primitives/docs/components/accordion
https://www.radix-ui.com/primitives/docs/components/navigation-menu
https://www.radix-ui.com/primitives/docs/components/context-menu
https://www.radix-ui.com/primitives/docs/components/radio-group
https://www.radix-ui.com/primitives/docs/components/switch
https://www.radix-ui.com/primitives/docs/components/toggle
https://motion.dev/docs/react-quick-start
https://motion.dev/docs/react-animation
https://motion.dev/docs/react-layout-animations
https://motion.dev/docs/react-gestures
https://motion.dev/docs/react-scroll-animations
https://motion.dev/docs/react-shared-layout-animations
https://orm.drizzle.team/docs/rqb
https://orm.drizzle.team/docs/relations
https://orm.drizzle.team/docs/select
https://orm.drizzle.team/docs/joins
https://orm.drizzle.team/docs/tx
https://orm.drizzle.team/docs/migrations
https://playwright.dev/docs/intro
https://playwright.dev/docs/writing-tests
https://playwright.dev/docs/test-annotations
https://playwright.dev/docs/mock
https://playwright.dev/docs/auth
https://playwright.dev/docs/ci
https://playwright.dev/docs/trace-viewer
```

---

## 🧩 Batch 26 — Full-Stack TypeScript Deep Dives & Testing

**Priority**: MEDIUM — TypeScript mastery and testing infrastructure
**Estimated chunks**: ~45–55

| Topic | Scope | Source |
|-------|-------|--------|
| `react-table` (TanStack Table v8) | Column definitions, header groups, row model, sorting, filtering (global + column), pagination, row selection, column resizing, virtualization, column pinning, grouping, aggregation, manual pagination, server-side pagination | Context7 + tanstack.com |
| `msw` (Mock Service Worker) | Handlers (rest/http), request matching, response simulation, GraphQL handlers, lifecycle events, setup server, browser integration, MSW in tests ( Vitest/Jest), network error simulation, delay, JSON responses | Context7 + mswjs.io |
| `testing-library` (React) | render, screen, fireEvent, userEvent, waitFor, findBy, queryBy, within, async queries, mocking modules, mocked hook patterns, custom render with providers | Context7 + testing-library.com |
| `eslint-nextjs` | Recommended config, core web vitals, TypeScript strict rules, import rules, no-unused-vars patterns, no-explicit-any warnings, consistent type imports, project structure conventions | Context7 + nextjs.org |
| `sonner` (toasts) | Toast variants, custom toasts, promise toasts, rich content, position, duration, undo, dismiss, grouping, styling, Sonner provider setup | Context7 + sonner.emilkow.al |

### URL Sources
```
https://tanstack.com/table/latest/docs/introduction
https://tanstack.com/table/latest/docs/framework/react/guide/column-defs
https://tanstack.com/table/latest/docs/framework/react/guide/tables
https://tanstack.com/table/latest/docs/framework/react/guide/sorting
https://tanstack.com/table/latest/docs/framework/react/guide/filtering
https://tanstack.com/table/latest/docs/framework/react/guide/pagination
https://tanstack.com/table/latest/docs/framework/react/guide/row-selection
https://tanstack.com/table/latest/docs/framework/react/guide/virtualization
https://mswjs.io/docs/getting-started
https://mswjs.io/docs/api/http
https://mswjs.io/docs/api/graphql
https://mswjs.io/docs/recipes
https://mswjs.io/docs/faq
https://testing-library.com/docs/react-testing-library/intro/
https://testing-library.com/docs/react-testing-library/example-integration/
https://nextjs.org/docs/app/building-your-application/configuring/eslint
https://sonner.emilkow.al/getting-started
https://sonner.emilkow.al/usage
```

---

## 🚀 Batch 27 — Full-Stack Deployment & DevOps

**Priority**: MEDIUM — Production deployment patterns
**Estimated chunks**: ~45–55

| Topic | Scope | Source |
|-------|-------|--------|
| `vercel-deep` | Edge functions (edge runtime, compatible APIs), ISR config in `next.config.js`, `after()`, image optimization (`next/image` advanced), rewrites/redirects, headers, analytics, speed insights, Vercel KV + Postgres, preview deployments, monorepo deploy | Context7 + vercel.com |
| `docker-nextjs` | Multi-stage Dockerfile, standalone output mode, `output: 'standalone'` in next.config, health checks, layer caching, alpine builds, env vars at build vs runtime, Docker Compose with DB, production optimization | Context7 + Docker docs |
| `github-actions-nextjs` | CI workflow (install, lint, type-check, test, build), matrix builds, caching (node_modules, .next), preview deployments, environment secrets, Vercel CLI deploy, build artifact upload, concurrency groups | Context7 + GitHub docs |
| `sentry` (error tracking) | Next.js SDK setup, `sentry.client.config.ts`, source maps upload, release tracking, error boundaries (captureException), performance monitoring (traces, spans), session replay, alerts, sourcemap plugin in next.config | Context7 + sentry.io |
| `cloudflare-pages` | Static export + `_worker.js`, hybrid rendering, Pages Functions, KV/D1 bindings, build configuration, preview URLs, custom domains, `_routes.json` for caching | Context7 + Cloudflare docs |

### URL Sources
```
https://vercel.com/docs/frameworks/nextjs
https://vercel.com/docs/frameworks/nextjs/advanced
https://vercel.com/docs/frameworks/nextjs/ ISR
https://vercel.com/docs/storage/vercel-kv
https://vercel.com/docs/storage/vercel-postgres
https://nextjs.org/docs/app/api-reference/config/next-config-js/output
https://docs.docker.com/get-started/docker-images/build-master/
https://docs.docker.com/compose/
https://docs.github.com/en/actions
https://docs.sentry.io/platforms/javascript/guides/nextjs/
https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/
https://developers.cloudflare.com/pages/
https://developers.cloudflare.com/pages/functions/
```

---

## 📡 Batch 28 — Full-Stack Real-time & Advanced Patterns

**Priority**: LOW — Nice-to-have for real-time features
**Estimated chunks**: ~40–50

| Topic | Scope | Source |
|-------|-------|--------|
| `socket.io` | Server setup, client connection, rooms, namespaces, middleware, events (emit/on), acknowledgment, broadcasting, reconnection, Socket.io with Next.js (API routes), adapter, Redis adapter for scaling | Context7 + socket.io |
| `server-sent-events` (SSE) | EventSource API, `ReadableStream` in Next.js route handlers, `useEffect` streaming hooks, reconnection, event types, combining with React Suspense, AI streaming patterns | Context7 + MDN |
| `nextjs-image` (advanced) | `fill`, `sizes` prop, remote patterns, device sizes, image blur placeholder, priority loading, SVG support, custom loader, blur hash, responsive images, lazy loading control, animated GIF handling | Context7 + nextjs.org |
| `nextjs-fonts` | `next/font/google`, `next/font/local`, variable fonts, font subsets, fallback fonts, font display swap, preload, CSS variable injection, Tailwind integration | Context7 + nextjs.org |
| `nextjs-metadata` | `Metadata` type, `generateMetadata`, OpenGraph images, Twitter cards, canonical URLs, sitemap generation, robots.txt, structured data (JSON-LD), dynamic metadata per route | Context7 + nextjs.org |

### URL Sources
```
https://socket.io/docs/v4/
https://socket.io/docs/v4/server-api/
https://socket.io/docs/v4/client-api/
https://socket.io/docs/v4/rooms/
https://socket.io/docs/v4/middlewares/
https://nextjs.org/docs/app/api-reference/components/image
https://nextjs.org/docs/app/api-reference/functions/generate-metadata
https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
https://nextjs.org/docs/app/building-your-application/optimizing/fonts
https://nextjs.org/docs/app/building-your-application/optimizing/metadata
```

---

## Unity Batches (10–23) — DONE

| Batch | Topic | Status |
|-------|-------|--------|
| 10 | Particle Systems, VFX Graph | ✅ **Imported to D1** (7 chunks) |
| 11 | Effects & Post-Processing, Decals, Fog | ✅ **Imported to D1** (33 chunks) |
| 12 | Build Profiles, Build Automation | ✅ **Imported to D1** (7 chunks) |
| 13 | Unity 6.0 Features (GPU Resident Drawer, Sentis ML) | ✅ **Imported to D1** (19 chunks) |
| 17 | Renderers, GPU Instancing, LOD, Occlusion | ✅ **Imported to D1** (21 chunks) |
| 18 | Camera, Cinemachine Advanced | ✅ **Imported to D1** (13 chunks) |
| 19 | Scene Management Advanced | ✅ **Covered by existing** unity-scene-management |
| 20 | Interfaces (IPointer, IDrag, EventSystem) | ✅ **Imported to D1** (24 chunks) |
| 21 | Editor Scripting, Custom Inspectors | ✅ **Imported to D1** (23 chunks) |
| 22 | Player Settings, Quality Settings | ✅ **Imported to D1** (47 chunks) |
| 23 | Graphics API, CommandBuffer, Compute Shaders | ✅ **Imported to D1** (8 chunks) |

---

## ✅ Batch 32 — Minimalist UI CSS Frameworks — DONE

**Priority**: MEDIUM — Classless CSS frameworks for minimalist UIs
**Status**: ✅ Indexed and imported to D1 (3 + 9 + 3 + 9 + 286 = 310 chunks)

| Topic | Scope | Source |
|-------|-------|--------|
| `pico-css` | Classless semantic CSS, dark mode, SASS customization, responsive, forms, components, utilities | picocss.com + Context7 |
| `watercss` | Classless CSS, CSS variables, theme switching, dark/light modes, custom branding | Context7 (SPA) |
| `mvp-css` | Classless CSS for MVP landing pages, CSS variables, dark mode, semantic HTML | andybrewer.github.io + GitHub |
| `new-css` | Classless CSS framework, responsive, dark mode, CSS custom properties | Context7 (SPA) |
| `radix-themes` | Unstyled React primitives (button, card, dialog, tabs, select, checkbox, switch, tooltip, popover, etc.) | radix-ui.com |

### URL Sources
```
https://picocss.com/docs
https://picocss.com/docs/classless
https://picocss.com/docs/forms
https://andybrewer.github.io/mvp/
https://github.com/andybrewer/mvp
https://www.radix-ui.com/themes/docs/overview/getting-started
https://www.radix-ui.com/themes/docs/components/button
https://www.radix-ui.com/themes/docs/components/card
https://www.radix-ui.com/themes/docs/components/dialog
https://www.radix-ui.com/themes/docs/components/tabs
https://www.radix-ui.com/themes/docs/components/select
https://www.radix-ui.com/themes/docs/components/checkbox
https://www.radix-ui.com/themes/docs/components/switch
https://www.radix-ui.com/themes/docs/components/tooltip
https://www.radix-ui.com/themes/docs/components/popover
```

---

## ⏳ Batch 34 — IAP Deep, Ads, Unity Networking, Figma, Canva — PENDING IMPORT

**Priority**: HIGH — Monetization, networking, and design tools for cross-platform development
**Status**: ⏳ Scraped, needs import to D1
**Estimated chunks**: ~210
**Platforms**: Windows, Android, iOS (where applicable)

| Topic | Scope | Source |
|-------|-------|--------|
| `iap-deep` | Unity IAP (cross-platform, codeless), Google Play Billing v5+ (Android), Apple StoreKit 2 (iOS), Windows Store IAP (Microsoft Partner Center), RevenueCat Paywalls (configuration, A/B testing), paywall design patterns (hard, soft, metered, trial, gated), subscription lifecycle | Context7 + Unity docs + Google/Apple/MS docs |
| `ads-monetization` | Google AdMob (Unity/Android/iOS: banner, interstitial, rewarded, native, app open), Unity Ads / LevelPlay (mediation, A/B testing), Meta Audience Network, AppLovin MAX (unified auction, 25+ networks), ironSource → LevelPlay, Chartboost, Google AdSense (web), ad mediation comparison (waterfall vs in-app bidding) | Context7 + Google/Unity/AppLovin/Meta docs |
| `unity-networking-deep` | Photon PUN2 (legacy, room-based), Photon Fusion 2 (state replication, prediction/rollback, AoI), Photon Quantum (deterministic ECS, 128 players), Mirror (open-source, 12+ transports, interest management), FishNet (server-authoritative, free), Unity Transport Package (UTP), Nakama (game server: auth, matchmaking, chat, leaderboards), comparison by game type | Context7 + Photon/Mirror/FishNet/Nakama docs |
| `figma` | Figma REST API (files, comments, versions, webhooks, components, variables), Figma Plugin API (code.ts, UI, node operations, codegen), Figma Code Connect (React, Vue), Figma MCP Server (AI workflow integration), Dev Mode, design tokens, variable modes | Context7 + Figma docs |
| `canva` | Canva Connect API (designs, exports, brand kits, assets, folders), Canva Apps SDK (content apps, design extensions, data apps), Canva MCP Server (community), Node.js/Python SDKs, Canva vs Figma comparison | Context7 + Canva docs |

### Dependencies
| Package | Topic | Purpose |
|---------|-------|--------|
| `com.unity.purchasing` | iap-deep | Unity IAP package |
| `com.google.android.ads` | ads-monetization | AdMob Android SDK |
| `com.google.unity.ads` | ads-monetization | AdMob Unity plugin |
| `com.unity.ads` | ads-monetization | Unity Ads SDK |
| `com.unity.services.mediation` | ads-monetization | LevelPlay mediation |
| `com.applovin.sdk` | ads-monetization | AppLovin MAX SDK |
| Photon Fusion 2 | unity-networking-deep | Photon networking |
| Photon Quantum | unity-networking-deep | Deterministic ECS |
| Mirror | unity-networking-deep | Open-source networking |
| FishNet | unity-networking-deep | Server-authoritative |
| nakama-dotnet | unity-networking-deep | Game server client |
| `figma-js` | figma | REST API client |
| `@figma/code-connect` | figma | Code Connect |
| `@canva/connect-api` | canva | Node.js SDK |

### MCP Servers (Future Reference)
| Tool | Topic | Purpose |
|------|-------|--------|
| `@anthropic-ai/figma-mcp-server` | figma | Figma design context for AI agents |
| `@nicholasgriffintn/canva-mcp` | canva | Canva integration for AI agents |

### Import Commands
```bash
for topic in iap-deep ads-monetization unity-networking-deep figma canva; do
  export OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY packages/web/.dev.vars | cut -d'"' -f2)
  node packages/cli/dist/src/main.js index knowledge/$topic
  node packages/cli/dist/src/main.js export --path knowledge/$topic -o knowledge/$topic-export
  npx tsx packages/web/import.ts knowledge/$topic-export sce-db --append
done
```

---

## Deferred / Parked Topics

| Category | Topics | Why Deferred |
|----------|--------|--------------|
| Python web | Django, Flask | FastAPI covers current needs |
| Web paywalls | Stripe, PayPal | No SaaS billing yet |
| Cloud (full) | AWS, Azure, GCP full | google-cloud-thin covers essentials |
| Containers | Kubernetes, Podman | Docker + ngrok indexed |
| CRMs | HubSpot, Monday | Not in current stacks |
| Desktop | Electron | Not shipping Electron |
| API tooling | Postman | ngrok covers debugging |

---

## Indexing Workflow

```bash
# 1. Create URL list
#    knowledge/urls/<topic>.txt

# 2. Scrape (for web docs)
npx tsx packages/web/cf-scraper.ts knowledge/urls/<topic>.txt knowledge/<topic>

# 3. Create sce.config.json (see existing topics for template)

# 4. Index
export OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY packages/web/.dev.vars | cut -d'"' -f2)
node packages/cli/dist/src/main.js index knowledge/<topic>

# 5. Export
node packages/cli/dist/src/main.js export --path knowledge/<topic> -o knowledge/<topic>-export

# 6. Import to D1
npx tsx packages/web/import.ts knowledge/<topic>-export sce-db --append

# 7. Import vectors (if generated)
npx tsx packages/web/import.ts knowledge/<topic>-export sce-db --vectors-only --append

# 8. Update INVENTORY.md and HANDOFF.md
```

---

## Notes

- Unity docs via Context7 generally produce better chunks than direct scraping
- Large pages (MDN, Node.js docs) need splitting or Context7 fallback
- Embedding config in sce.config.json causes failure without API key — use keyword-only for initial index
- D1 batch size: chunks=2, vectors=2 (stay under ~100KB statement limit)
- Scraped topics from batch 6+ onwards already in D1
- Full-stack batches (24–28) use Context7 primarily for React/Next.js/TS topics — more reliable than scraping SPA docs
