# D1 Knowledgebase Inventory

**Last Updated**: 2026-07-25
**D1 Live Total**: **~5532 chunks, ~3019 vectors** (added Unity++: unity-packages-complete 57)
**Live**: https://sce-web.pasttime.xyz/ · **API**: https://sce-api.pasttime.xyz

## Status

All planned expansion batches (1–9, 14–16), Batch 24 (full-stack React/Next.js), Batch 34 (IAP/Ads/Networking/Figma/Canva/Payments), Unity 6000.3 Scripting API + Manual, RetroUI (124 chunks), and Unity Splines deep (25 chunks) are **imported to D1**. Batch 24 topics use chunk splitting for documents exceeding ~7500 chars, with multi-part search expansion in the API.

## Batch 34 — IAP Deep, Ads, Unity Networking, Figma, Canva (**in D1**)

| Topic | Chunks | Vectors | Status |
|-------|--------|---------|--------|
| `iap-deep` | 83 | 0 | ✅ Imported |
| `ads-monetization` | 73 | 0 | ✅ Imported |
| `unity-networking-deep` | 72 | 0 | ✅ Imported |
| `figma` | 36 | 0 | ✅ Imported |
| `canva` | 41 | 0 | ✅ Imported |
| `payment-platforms` | 85 | 0 | ✅ Imported |
| **Total** | **390** | **0** | |

### Batch 34 Details

**IAP Deep (`iap-deep`)** — Deep dive into in-app purchases across platforms:
- Unity IAP package (cross-platform, codeless, consumables, non-consumables, subscriptions)
- Google Play Billing v5+ (Android integration, subscriptions, RTDN)
- Apple StoreKit 2 (iOS, promotional offers, introductory pricing)
- Windows Store IAP (Microsoft Partner Center, UWP)
- RevenueCat Paywalls (configuration, A/B testing, analytics)
- Paywall design patterns (hard, soft, metered, trial, gated)

**Ads Monetization (`ads-monetization`)** — Comprehensive ad network coverage:
- Google AdMob (Unity, Android, iOS — banner, interstitial, rewarded, native, app open)
- Unity Ads / LevelPlay (mediation, A/B testing, player segmentation)
- Meta Audience Network (Facebook demand, Unity integration)
- AppLovin MAX (unified auction, 25+ networks, reporting APIs)
- ironSource → LevelPlay migration
- Chartboost (cross-promotion)
- Google AdSense (web monetization)
- Ad mediation platforms comparison (waterfall vs in-app bidding)

**Unity Networking Deep (`unity-networking-deep`)** — All major networking solutions:
- Photon PUN2 (legacy, room-based, state sync via PhotonView)
- Photon Fusion 2 (state replication, server-authoritative, prediction/rollback, AoI)
- Photon Quantum (deterministic ECS, 128 players, predict/rollback)
- Mirror (open-source, high-level API, 12+ transports, interest management)
- FishNet (server-authoritative, free, relevancy, time manager)
- Unity Transport Package (UTP, low-level, UDP/WebTransport/QUIC)
- Nakama (open-source game server, auth, matchmaking, chat, leaderboards)
- Comparison matrix by game type and transport

**Figma (`figma`)** — Design tool, API, plugin development:
- Figma REST API (files, comments, versions, webhooks, components, variables)
- Figma Plugin API (code.ts, UI, node operations, codegen, variables)
- Figma Code Connect (React, Vue, custom frameworks)
- Figma MCP Server (AI workflow integration)
- Dev Mode, design tokens, variable modes

**Canva (`canva`)** — Design tool, Connect API, Apps SDK:
- Canva Connect API (designs, exports, brand kits, assets, folders)
- Canva Apps SDK (content apps, design extensions, data apps)
- Canva MCP Server (community implementation)
- Node.js and Python SDKs
- Canva vs Figma comparison

**Payment Platforms (`payment-platforms`)** — Web/SaaS billing:
- Stripe (Checkout, Elements, Subscriptions, Billing Portal, Webhooks)
- PayPal (Checkout, Orders, Subscriptions)
- Paddle (Merchant of Record, global tax, subscriptions)
- Braintree (Drop-in UI, Hosted Fields, PayPal integration)
- Lemon Squeezy (MoR, license keys, digital products)
- RevenueCat (Web integration, paywalls)
- Platform comparison matrix

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
| `stripe` | payment-platforms | Stripe Node.js SDK |
| `@stripe/stripe-js` | payment-platforms | Stripe browser SDK |
| `@paypal/paypal-server-sdk` | payment-platforms | PayPal Node.js SDK |
| `@paddle/paddle-node-sdk` | payment-platforms | Paddle Node.js SDK |
| `braintree` | payment-platforms | Braintree Node.js SDK |
| `@lemonsqueezy/lemonsqueezy.js` | payment-platforms | Lemon Squeezy JS SDK |

### MCP Servers (Future Reference)
| Tool | Topic | Purpose |
|------|-------|--------|
| `@anthropic-ai/figma-mcp-server` | figma | Figma design context for AI |
| `@nicholasgriffintn/canva-mcp` | canva | Canva integration for AI |

### URL Sources
- `knowledge/urls/iap-deep.txt` — Unity IAP, Play Billing, StoreKit, Windows Store, RevenueCat
- `knowledge/urls/ads-monetization.txt` — AdMob, Unity Ads, AppLovin, Meta, ironSource, Chartboost, AdSense
- `knowledge/urls/unity-networking-deep.txt` — Photon, Mirror, FishNet, UTP, Nakama
- `knowledge/urls/figma.txt` — REST API, Plugin API, Code Connect, MCP Server
- `knowledge/urls/canva.txt` — Connect API, Apps SDK, MCP Server

### Import Commands
```bash
# Index each topic
for topic in iap-deep ads-monetization unity-networking-deep figma canva; do
  export OPENROUTER_API_KEY=$(grep OPENROUTER_API_KEY packages/web/.dev.vars | cut -d'"' -f2)
  node packages/cli/dist/src/main.js index knowledge/$topic
  node packages/cli/dist/src/main.js export --path knowledge/$topic -o knowledge/$topic-export
  npx tsx packages/web/import.ts knowledge/$topic-export sce-db --append
done
```

## Topic Summary

Counts from local `.sce/metadata.sqlite` per topic (keyword search works even when vectors < chunks).

| Topic | Chunks | Vectors | Scope |
|-------|--------|---------|-------|
| **Own-repo corpora** | | | |
| SCE packages | 290 | 290 | `packages/` |
| word-guess | 423 | 423 | `E:\Projects\Indie\word-guess` |
| web-portfolio | 155 | 155 | `E:\Projects\Web\web-portfolio` |
| **Batch 1 — mobile / word-guess** | | | |
| expo | 23 | 23 | Expo + EAS |
| firebase | 20 | 18 | Auth, Firestore, Remote Config, rules |
| google-cloud-thin | 185 | 182 | **Deepened**: Compute, Cloud Run, Functions, Storage, SQL, Firestore, Bigtable, Pub/Sub, Tasks, GKE, Build, Logging, Monitoring, Secret Manager, API Gateway, CDN, Load Balancing, VPC, IAM, Scheduler, Deployment Manager, Source Repos |
| react-native | 11 | 11 | RN core docs |
| kotlin | 8 | 8 | Android / Kotlin light |
| monetization-iap | 24 | 23 | IAP, RevenueCat, AdMob, Play/App billing |
| play-console | 3 | 3 | Play Console + support |
| apple-gamecenter-iap | 5 | 5 | Game Center + StoreKit |
| rn-tooling | 15 | 15 | Zustand, Maestro, Jest, RNTL |
| **Batch 2 — portfolio / glue** | | | |
| tailwind-css | 4 | 4 | Tailwind v4 (Context7; scrapes trimmed) |
| resend | 5 | 5 | Transactional email |
| vercel | 5 | 5 | Deploy + env |
| t3-env | 4 | 4 | Typed env |
| zod | 4 | 3 | Schema validation |
| drizzle-neon | 12 | 12 | Drizzle + Neon Postgres |
| fastapi-python | 10 | 10 | FastAPI + Python tutorial |
| docker-ngrok | 7 | 6 | Docker Compose + ngrok |
| **Batch 3 — SCE platform** | | | |
| wrangler | 5 | 4 | Wrangler CLI + Workers testing |
| openrouter | 4 | 3 | Embeddings / routing |
| mcp | 6 | 6 | MCP SDK + spec |
| sqlite | 6 | 3 | SQL, FTS5, better-sqlite3 |
| **Batch 4 — Unity + UI + CI** | | | |
| unity-entities | 17 | 17 | ECS deepen |
| unity-cinemachine | 13 | 13 | Cinemachine deepen |
| unity-netcode | 18 | 18 | Netcode for GameObjects |
| unity-shaders | 13 | 13 | ShaderLab / HLSL + Shader Graph |
| shadcn | 17 | 17 | shadcn/ui components |
| nativewind | 11 | 11 | NativeWind (RN + Tailwind) |
| github-actions | 16 | 15 | GitHub Actions workflows |
| **Batch 5** | | | |
| bolt | 7 | 7 | bolt.new |
| shieldcn | 7 | 7 | shieldcn (Context7; SPA) |
| **Base corpus (pre-expansion + shared stack)** | | | |
| cloudflare-workers | 15 | 15 | Workers, D1, DO, KV, R2, Vectorize, Queues, Workers AI |
| react | 13 | 12 | React docs + hooks (Context7) |
| nextjs | 11 | 11 | Next.js App Router (Context7) |
| typescript | 9 | 9 | TS handbook + utility types |
| hono | 11 | 11 | Hono routing / middleware |
| vitest | 10 | 10 | Vitest + mocking |
| drizzle-orm | 5 | 4 | Drizzle ORM overview (separate from drizzle-neon) |
| prisma | 3 | 3 | Prisma ORM |
| postgresql | 3 | 3 | Postgres indexes, JSON, plpgsql |
| redis | 2 | 1 | Redis commands |
| trpc | 4 | 4 | tRPC procedures |
| tree-sitter | 2 | 2 | Parser usage |
| openai-api | 3 | 3 | OpenAI API / embeddings |
| unity | 6 | 6 | Unity Manual, Components, GameObjects, MonoBehaviours |
| unity-addressables | 2 | 2 | Addressables system |
| unity-async | 11 | 11 | Async/Await, UniTask, CancellationToken |
| unity-coroutines | 6 | 6 | IEnumerator, yield patterns |
| unity-events | 6 | 6 | UnityEvent, UnityAction, C# events |
| unity-scene-management | 7 | 7 | Scene loading, transitions, additive scenes |
| unity-scriptable-objects | 6 | 6 | Data containers, event channels |
| unity-ui-toolkit | 2 | 2 | UI Toolkit, USS/UXML |
| unreal-engine | 1 | 1 | Unreal Blueprints |
| cpp | 3 | 3 | C++ getting started + cppreference |
| csharp | 4 | 4 | C# / .NET async, generics |
| **Batch 6 — expanded topics** | | | |
| rest-api | 12 | 12 | REST patterns, auth flows, retry, rate limits |
| flutter | 6 | 6 | Flutter widgets, navigation, state management |
| dart | 7 | 7 | Dart language, async, isolates |
| supabase | 7 | 7 | Auth, RLS, realtime, storage, edge functions |
| aws-amplify | 6 | 6 | Amplify auth, data (GraphQL), storage |
| nodejs | 9 | 9 | Node.js core, streams, fs, workers |
| express | 7 | 7 | Express routing, middleware, error handling |
| html | 6 | 6 | Semantic HTML, forms, accessibility |
| css | 8 | 8 | Flexbox, Grid, custom properties, responsive |
| jquery | 7 | 7 | Selectors, DOM, events, AJAX |
| bigquery | 5 | 5 | SQL, partitioning, streaming |
| ci-cd-pipelines | 7 | 7 | GitHub Actions, deploy, matrix, caching |
| object-pooling | 6 | 6 | Generic pool pattern, Unity usage |
| vector-math | 5 | 5 | Vector2/3, quaternions, formulas |
| unity-cloud | 87 | 75 | **NEW**: Cloud Save, Analytics, Remote Config, Leaderboards, Multiplayer, Economy, Authentication, Vivox, LevelPlay, Deployment |
| unity-ui | 92 | 92 | **NEW**: UGUI (Canvas, RectTransform, Image, Text, Button, Toggle, Slider, ScrollRect, EventSystem), UI Toolkit (VisualElement, USS, UXML, UI Builder, manipulators), TextMeshPro (fonts, rich text, input field, mesh modifiers) |
| design-patterns | 127 | 127 | **NEW**: Mobile UI screen patterns (onboarding, login, feed, settings, etc.), Material Design 3 components (buttons, cards, chips, navigation, input), Apple HIG iOS patterns, UI-Patterns.com catalog |
| spline | 6 | 6 | **Deepened**: Unity Splines package (knots, evaluation, SplineContainer, Animate, Instantiate, Mesh, Extrude, Jobs) + generic Bezier/Catmull-Rom formulas |
| unity-splines | 25 | 25 | **NEW**: Unity Splines deep reference — SplineContainer, BezierKnot, CatmullRomKnot, LinearKnot, SplineAnimate, SplineInstantiate, SplineMesh, SplineExtrude, evaluation, distance, Jobs |
| filestream | 58 | 0 | Node.js fs/streams/buffer, Python file I/O |
| scientific-notation | 15 | 15 | BigInt, Number, float precision, Python decimal |
| linq | 12 | 12 | C# LINQ + ZLinq zero-alloc |
| zlinq | 139 | 139 | **NEW**: ZLinq deep scrape (GitHub repo) — architecture, operators, SIMD, Unity, LINQ to Tree |
| dependency-injection | 6 | 6 | .NET DI, VContainer, Zenject |
| unity-scriptable-objects | 6 | 6 | Data containers, event channels |
| number-formatting | 5 | 5 | C#/JS formatting, scientific notation |
| localization | 5 | 5 | Unity, Flutter, i18n patterns |
| unity-events | 5 | 5 | UnityEvent, UnityAction, C# events |
| unity-coroutines | 5 | 5 | IEnumerator, yield patterns |
| unity-async | 10 | 10 | Awaitable, UniTask, CancellationToken |
| unit-testing | 5 | 5 | NUnit, Vitest, Unity Test Framework, Moq |
| unity-scene-management | 7 | 7 | Load, unload, DontDestroyOnLoad |
| dotween | 7 | 7 | Move, scale, rotate, sequences, easing |
| litmotion | 5 | 5 | Zero-alloc tween, DOTS-compatible |
| primetween | 6 | 6 | Shake, cycle, sequence, config |
| zlib | 5 | 5 | GZip, deflate, compression formats |
| data-encryption | 5 | 5 | AES, RSA, hashing, JWT |
| system-io | 6 | 6 | FileStream, directory, path, MemoryStream |
| luminosity-formula | 6 | 6 | Luminance, WCAG contrast ratio |
| auth-patterns | 11 | 11 | JWT, OAuth2 PKCE, refresh tokens, sessions |
| **Batch 7 — UI libraries** | | | |
| retroui | 124 | 124 | RetroUI neobrutalist React components (shadcn-compatible) |
| **Batch 8 — Animation libs** | | | |
| dotmatrix | 26 | 26 | Dot Matrix loading animation components (91 loaders) |
| **Batch 9 — misc docs** | | | |
| filestream | 58 | 58 | Node.js fs/streams/buffer, Python file I/O |
| scientific-notation | 15 | 15 | BigInt, Number, float precision, Python decimal |
| **Batch 14 — Unity Collisions** | | | |
| unity-collisions | 23 | 23 | Colliders, triggers, raycasting, physics queries |
| **Batch 15 — Unity Joints** | | | |
| unity-joints | 28 | 28 | Joints, springs, vehicle suspension, ragdoll |
| **Batch 16 — Unity Primitives** | | | |
| unity-primitives | 18 | 18 | Mesh API, procedural generation, terrain |
| **Batch 10 — Unity Particles & VFX** | | | |
| unity-particles-vfx | 7 | 7 | Particle System, VFX Graph, emission, shapes, physics, trails, scripting |
| **Batch 11 — Unity Post-Processing & Effects** | | | |
| unity-postprocessing-fog | 33 | 33 | Bloom, Color Grading, DOF, Motion Blur, AO, SSR, Vignette, Decals, Fog |
| **Batch 12 — Unity Build** | | | |
| unity-build-profiles | 7 | 7 | Build Profiles, Build Pipeline, BuildReport, EditorBuildSettings |
| **Batch 13 — Unity 6 Features** | | | |
| unity-v6-features | 19 | 19 | GPU Resident Drawer, Sentis ML inference, DOTS improvements, Animation Rigging |
| **Batch 17 — Unity Renderers & LOD** | | | |
| unity-renderers-lod | 21 | 21 | MeshRenderer, SkinnedMeshRenderer, TrailRenderer, GPU Instancing, LODGroup, OcclusionCulling |
| **Batch 18 — Unity Camera & Cinemachine** | | | |
| unity-camera-advanced | 13 | 13 | Camera rays, ObliqueFrustum, RenderTexture, Cinemachine advanced (FreeLook, StateDriven, Impulse, Confiner) |
| **Batch 20 — Unity Input Interfaces** | | | |
| unity-interfaces | 24 | 24 | IPointer, IDrag, IScroll, ISubmit, EventSystem, Input System, PointerEventData |
| **Batch 21 — Unity Editor Scripting** | | | |
| unity-editor-scripting | 23 | 23 | CustomEditor, EditorWindow, PropertyDrawer, SerializedObject, EditorGUI, GUILayout |
| **Batch 22 — Unity Player Settings** | | | |
| unity-player-settings | 47 | 47 | PlayerSettings, QualitySettings, GraphicsSettings, platform config (Android/iOS/WebGL/Windows) |
| **Batch 23 — Unity Graphics API** | | | |
| unity-graphics-api | 8 | 8 | CommandBuffer, ComputeShader, RenderPipeline, Graphics Jobs |
| **Batch 25 — Full-Stack UI & Polish** | | | |
| radix-ui | 303 | 211 | Radix UI Primitives — Dialog, Popover, Tooltip, Select, DropdownMenu, Tabs, Accordion, NavigationMenu, ContextMenu, RadioGroup, Switch, Toggle, Collapsible, Slider, ScrollArea |
| framer-motion | 49 | 49 | Motion for React — AnimatePresence, layout animations, gestures, scroll, variants, spring physics, motion values |
| drizzle-deep | 37 | 37 | Drizzle ORM deep — relations, joins, transactions, relational query builder, $with, subqueries |
| playwright | 55 | 55 | Playwright testing — fixtures, page objects, locators, assertions, mocking, trace viewer, CI |
| caching-strategies | 51 | 51 | Next.js caching — fetch cache, unstable_cache, ISR, revalidateTag, revalidatePath, stale-while-revalidate |
| **Unity Packages** | | | |
| unity-postprocessing-package | 34 | 34 | Post Processing Stack v2 — Bloom, DOF, Color Grading, AO, SSR, Vignette, Volume system, custom effects |
| unity-build-pipeline | 32 | 32 | Scriptable Build Pipeline — BuildPlayer, Asset Bundles, Content Pipeline, Script Compilation, Build Reports |
| unity-test-framework | 39 | 39 | Test Framework — Edit Mode/Play Mode tests, assertions, parameterized tests, performance testing, mocking |
| unity-ui-test-framework | 25 | 25 | UI Test Framework — UGUI/UI Toolkit testing, interaction simulation, visual validation, performance |
| unity-localization | 58 | 58 | Localization — String Tables, Asset Tables, Smart Strings, pluralization, runtime locale switching |
| unity-platform-toolkit | 34 | 34 | Platform Toolkit — Android/iOS/WebGL/Windows/Linux APIs, native code, build automation |
| **Batch 26 — Testing & TypeScript** | | | |
| react-table | 89 | 89 | TanStack Table v8 — column defs, sorting, filtering, pagination, row selection, virtualization, grouping |
| msw | 35 | 35 | Mock Service Worker — HTTP/GraphQL handlers, request matching, lifecycle events, Vitest/Jest integration |
| testing-library | 45 | 45 | React Testing Library — queries, user events, assertions, async utilities, mocking, debugging |
| eslint-nextjs | 25 | 25 | ESLint + TypeScript — Next.js rules, typescript-eslint, consistent type imports, no-explicit-any |
| sonner | 32 | 32 | Sonner toasts — toast types, promise toasts, actions, styling, themes, accessibility |
| **Batch 27 — Deployment & DevOps** | | | |
| vercel-deep | 39 | 39 | Vercel — Edge functions, ISR, KV/Postgres storage, image optimization, analytics, monorepos |
| docker-nextjs | 202 | 202 | Docker + Next.js — multi-stage builds, standalone output, Docker Compose, health checks, Alpine |
| github-actions-nextjs | 69 | 69 | GitHub Actions — CI workflows, caching, matrix builds, preview deployments, secrets |
| sentry-nextjs | 57 | 57 | Sentry — error tracking, performance monitoring, session replay, source maps, user feedback |
| cloudflare-pages | 81 | 81 | Cloudflare Pages — Functions, KV/D1/R2 bindings, custom domains, preview deployments |
| **Batch 28 — Real-time & Advanced** | | | |
| socket-io | 58 | 58 | Socket.io — server/client setup, rooms, namespaces, middleware, acknowledgements, error handling |
| server-sent-events | 35 | 35 | SSE — EventSource API, streaming, reconnection, React integration, AI streaming patterns |
| nextjs-image | 74 | 74 | next/image — fill mode, sizes, remote patterns, blur placeholder, priority, custom loader |
| nextjs-fonts | 32 | 32 | next/font — Google fonts, local fonts, CSS variables, display strategies, fallback metrics |
| nextjs-metadata | 40 | 40 | Metadata API — generateMetadata, OpenGraph, Twitter cards, sitemaps, robots.txt, viewport |
| **Batch 32 — Minimalist UI CSS** | | | |
| pico-css | 3 | 3 | Classless semantic CSS, dark mode, SASS |
| watercss | 9 | 9 | Classless CSS, CSS variables, themes |
| mvp-css | 3 | 3 | Classless CSS for MVP landing pages |
| new-css | 9 | 9 | Classless CSS framework |
| radix-themes | 286 | 270 | Unstyled React primitives (button, card, dialog, tabs) |
| **Local knowledge subtotal** | **~3430** | **~3350** | 136 doc topics under `knowledge/` |
| **Local grand total (incl. corpora)** | **~4298** | **~4218** | |

## Expansion Queue

| Batch | Topics | Status |
|-------|--------|--------|
| 1a–1e | Expo/EAS, Firebase, GCP thin, RN, Kotlin, IAP/RevenueCat/AdMob, Play Console, Game Center/StoreKit, Zustand/Maestro/Jest | ✅ **Imported to D1** |
| 2 | Tailwind v4, Resend, Vercel, t3-env, Zod, Drizzle+Neon, FastAPI, Docker, ngrok | ✅ **Imported to D1** |
| 3 | Wrangler, OpenRouter, MCP SDK, SQLite deepen | ✅ **Imported to D1** |
| 3b | Own-repo corpora (SCE packages, word-guess, web-portfolio) | ✅ **Imported to D1** |
| 4 | Unity Netcode, Unity Shaders, shadcn/ui, NativeWind, GitHub Actions | ✅ **Imported to D1** |
| 4b | Unity ECS deepen, Unity Cinemachine deepen | ✅ **Imported to D1** |
| 5 | shieldcn, bolt.new | ✅ **Imported to D1** |
| 6 | REST API, Flutter, Dart, Supabase, AWS Amplify, Node.js, Express, HTML, CSS, jQuery, BigQuery, CI/CD, Object Pooling, Vector Math, Spline, LINQ/ZLinq, DI, Unity ScriptableObjects, Number Formatting, Localization, Unity Events, Coroutines, Async/Awaitables, Unit Testing, Scene Management, DOTween, LitMotion, PrimeTween, zlib, Data Encryption, System.IO, Luminosity, Auth Patterns | ✅ **Imported to D1** |
| 7 | RetroUI (neobrutalist React components) | ✅ **Imported to D1** |
| 8 | Dot Matrix (loading animations) | ✅ **Imported to D1** |
| 9 | filestream (Node.js fs/streams, Python file I/O), scientific-notation (BigInt, float precision, Python decimal) | ✅ **Imported to D1** |
| 14 | Unity Collisions (colliders, triggers, raycasting) | ✅ **Imported to D1** |
| 15 | Unity Joints (springs, vehicle suspension, ragdoll) | ✅ **Imported to D1** |
| 16 | Unity Primitives (mesh API, procedural generation) | ✅ **Imported to D1** |
| **10** | **unity-particles-vfx (7)** — Particle System, VFX Graph | ✅ **Imported to D1** |
| **11** | **unity-postprocessing-fog (33)** — Bloom, DOF, AO, SSR, Decals, Fog | ✅ **Imported to D1** |
| **12** | **unity-build-profiles (7)** — Build Profiles, Build Pipeline | ✅ **Imported to D1** |
| **13** | **unity-v6-features (19)** — GPU Resident Drawer, Sentis ML, DOTS | ✅ **Imported to D1** |
| **17** | **unity-renderers-lod (21)** — Renderers, GPU Instancing, LOD, Occlusion | ✅ **Imported to D1** |
| **18** | **unity-camera-advanced (13)** — Camera, Cinemachine advanced | ✅ **Imported to D1** |
| **20** | **unity-interfaces (24)** — IPointer, IDrag, EventSystem, Input System | ✅ **Imported to D1** |
| **21** | **unity-editor-scripting (23)** — CustomEditor, EditorWindow, PropertyDrawer | ✅ **Imported to D1** |
| **22** | **unity-player-settings (47)** — PlayerSettings, QualitySettings, GraphicsSettings | ✅ **Imported to D1** |
| **23** | **unity-graphics-api (8)** — CommandBuffer, ComputeShader, RenderPipeline | ✅ **Imported to D1** |
| **24** | **tanstack-query (131), nextjs-deep (18), react-hook-form (11), nextjs-auth (3), ts-patterns (15)** | ✅ **Imported to D1** |
| **Unity+** | **unity-scripting-api (114), unity-manual-6000 (32)** | ✅ **Imported to D1** |
| **Unity++** | **unity-packages-complete (57)** — Addressables, Cinemachine, Netcode, Input System | ✅ **Imported to D1** |
| **25** | **radix-ui (303), framer-motion (49), drizzle-deep (37), playwright (55), caching-strategies (51)** | ✅ **Imported to D1** |
| **26** | **react-table (89), msw (35), testing-library (45), eslint-nextjs (25), sonner (32)** | ✅ **Imported to D1** |
| **27** | **vercel-deep (39), docker-nextjs (202), github-actions-nextjs (69), sentry-nextjs (57), cloudflare-pages (81)** | ✅ **Imported to D1** |
| **28** | **socket-io (58), server-sent-events (35), nextjs-image (74), nextjs-fonts (32), nextjs-metadata (40)** | ✅ **Imported to D1** |
| **29** | **unity-cloud (NEW), google-cloud-thin (deepen), spline (deepen)** | ✅ **Imported to D1** |
| **30** | **unity-ui (NEW)** | ✅ **Imported to D1** |
| **31** | **design-patterns (NEW)** | ✅ **Imported to D1** |
| **32** | **pico-css, watercss, mvp-css, new-css, radix-themes** | ✅ **Imported to D1** |
| **33** | **zlinq (deep scrape from Cysharp/ZLinq GitHub)** | ✅ **Imported to D1** |

## Expansion Roadmap

See `knowledge/EXPANSION-ROADMAP.md` for full details.

### Full-Stack Dev (Batches 24–28) — Active
- **Batch 24** ✅: tanstack-query (131 chunks), nextjs-deep (18), react-hook-form (11), nextjs-auth (3), ts-patterns (15) — **Done**
- **Unity 6000.3** ✅: unity-scripting-api (114), unity-manual-6000 (32) — **Done**
- **Batch 25** ✅: radix-ui, framer-motion, drizzle-deep, playwright, caching-strategies — **Done**
- **Batch 26** ✅: react-table, msw, testing-library, eslint-nextjs, sonner — **Done**
- **Batch 27** ✅: vercel-deep, docker-nextjs, github-actions-nextjs, sentry, cloudflare-pages — **Done**
- **Batch 28** ✅: socket.io, server-sent-events, nextjs-image, nextjs-fonts, nextjs-metadata — **Done**
- **Batch 32** ✅: pico-css (3), watercss (9), mvp-css (3), new-css (9), radix-themes (286) — **Done**

### Unity (Batches 10–23) — Deferred
- **Batch 10**: Particle Systems, VFX Graph
- **Batch 11**: Post-Processing, Decals, Fog
- **Batch 12**: Build Profiles, Build Automation
- **Batch 13**: Unity 6.0, GPU Resident Drawer, Sentis
- **Batch 17**: Renderers, GPU Instancing, LOD
- **Batch 18**: Camera, Cinemachine, Render Texture
- **Batch 19**: Scene Management, Additive Scenes
- **Batch 20**: Interfaces (IPointer, IDrag)
- **Batch 21**: Editor Scripting, Custom Inspectors
- **Batch 22**: Player Settings
- **Batch 23**: Graphics API, CommandBuffer, Compute Shaders

## Deferred Topics — do not pull

Parked per scope lock (2026-07-16). Do not scrape, index, or import until explicitly unparked.

**Monetization policy:** store IAP + RevenueCat + AdMob only (word-guess). Web/SaaS billing docs stay out until there is a paywall product.

| Category | Topics | Why deferred |
|----------|--------|--------------|
| Python web | Django, Flask | FastAPI + Python stdlib covers current API needs |
| Web paywalls | Stripe, PayPal, GoCardless | No web/SaaS billing yet; mobile IAP stack indexed |
| Cloud (full) | AWS, Azure, GCP (beyond thin) | `google-cloud-thin` covers Firebase/Play essentials only |
| Containers / orchestration | Kubernetes, Podman | Docker + ngrok indexed for local/dev workflows |
| CRMs | HubSpot, Monday.com, ClickUp | Not in current project stacks |
| Desktop | Electron | Not shipping Electron apps |
| API tooling | Postman | ngrok indexed for tunnel/webhook debugging |

**Unparked (batch 6):** REST API patterns, Flutter, Dart, Supabase, AWS Amplify, Node.js, Express, HTML, CSS, jQuery, BigQuery, CI/CD pipelines, Object Pooling, Vector Math, Spline, LINQ/ZLinq, Dependency Injection, Unity ScriptableObjects, Number Formatting, Localization, Unity Events, Coroutines, Async/Awaitables, Unit Testing, Scene Management, DOTween, LitMotion, PrimeTween, zlib, Data Encryption, System.IO, Luminosity Formula, Auth Patterns.

**Also not on the roadmap:** generic “Python” beyond FastAPI, full Tailwind HTML scrapes (Context7 only), Zustand official site scrape (SPA → Context7).

# Batch 4 — Unity deepen + new topics (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|--------|
| unity-entities (deepen) | 17 | 17 |
| unity-cinemachine (deepen) | 12 | 12 |
| unity-netcode (new) | 17 | 17 |
| unity-shaders (new) | 8 | 8 |
| shadcn (new) | 17 | 17 |
| nativewind (new) | 11 | 11 |
| github-actions (new) | 16 | 15 |
| **Total** | **98** | **97** |

# Batch 5 — shieldcn + bolt.new (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|--------|
| bolt (`knowledge/bolt/`) | 7 | 7 |
| shieldcn (`knowledge/shieldcn/`) | 7 | 7 |
| **Total** | **14** | **14** |

# Batch 6 — Expanded topics (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|--------|
| rest-api | 12 | 12 |
| flutter | 6 | 6 |
| dart | 7 | 7 |
| supabase | 7 | 7 |
| aws-amplify | 6 | 6 |
| nodejs | 9 | 9 |
| express | 7 | 7 |
| html | 6 | 6 |
| css | 8 | 8 |
| jquery | 7 | 7 |
| bigquery | 5 | 5 |
| ci-cd-pipelines | 7 | 7 |
| object-pooling | 6 | 6 |
| vector-math | 5 | 5 |
| spline | 5 | 5 |
| linq (LINQ + ZLinq) | 12 | 12 |
| dependency-injection | 6 | 6 |
| unity-scriptable-objects | 6 | 6 |
| number-formatting | 5 | 5 |
| localization | 5 | 5 |
| unity-events | 5 | 5 |
| unity-coroutines | 5 | 5 |
| unity-async | 10 | 10 |
| unit-testing | 5 | 5 |
| unity-scene-management | 7 | 7 |
| dotween | 7 | 7 |
| litmotion | 5 | 5 |
| primetween | 6 | 6 |
| zlib | 5 | 5 |
| data-encryption | 5 | 5 |
| system-io | 6 | 6 |
| luminosity-formula | 6 | 6 |
| auth-patterns | 11 | 11 |
| **Total** | **219** | **219** |

# Batch 7 — UI libraries (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|--------|
| retroui (`knowledge/retroui/`) | 124 | 124 |
| **Total** | **124** | **124** |

### Import notes
- Free OpenRouter embed model rate-limited intermittently; some doc topics have fewer vectors than chunks (keyword search still works).
- Oversized scrapes (Tailwind dumps, Docker builder, SQLite FTS5) truncated or replaced with Context7 to fit D1 statement limits.
- Helper scripts: `scripts/index-knowledge-batch.mjs`, `scripts/export-import-knowledge-batch.mjs`, `scripts/index-own-corpora.mjs`

# Batch 8 — Animation libs (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|--------|
| dotmatrix (`knowledge/dotmatrix/`) | 26 | 26 |
| **Total** | **26** | **26** |

# Batch 9 — Misc docs (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|--------|
| filestream (`knowledge/filestream/`) | 58 | 0 |
| scientific-notation (`knowledge/scientific-notation/`) | 15 | 0 |
| **Total** | **73** | **0** |

# Batch 24 — Full-Stack React/Next.js (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| tanstack-query | 131 | 131 | Split into multi-part chunks (max 7500 chars each) |
| nextjs-deep | 18 | 18 | Middleware, ISR, parallel/intercepting routes |
| react-hook-form | 11 | 11 | useForm, useFieldArray, Controller, Zod validation |
| nextjs-auth | 3 | 3 | Auth.js v5 setup, providers, sessions |
| ts-patterns | 15 | 15 | Discriminated unions, type narrowing, branded types |
| **Total** | **178** | **178** |

# Unity 6000.3 Scripting API & Manual (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| unity-scripting-api | 114 | 114 | 6000.3 ScriptReference: GameObject, Rigidbody, Collider, Camera, Animator, etc. |
| unity-manual-6000 | 32 | 32 | 6000.3 Manual: Physics, Rendering, Animation, UI, Scripting |
| **Total** | **146** | **146** |

---

## Cloudflare Workers
- workers.md (2 chunks)
- workers_get-started.md (2)
- workers_configuration.md (2)
- workers_configuration_bindings.md (2)
- workers_configuration_secrets.md (2)
- workers_configuration_environment-variables.md (2)
- workers_configuration_routing.md (2)
- workers_platform_limits.md (1)
- workers_platform_pricing.md (1)
- workers_platform_changelog.md (1)
- workers_examples.md (1)
- workers_examples_cron-trigger.md (1)
- workers_examples_multiple-cron-triggers.md (1)
- workers_testing.md (1)
- workers_testing_vitest-integration.md (1)
- workers_tutorials.md (1)
- workers_tutorials_build-a-slackbot.md (1)
- workers_tutorials_build-a-qr-code-generator.md (1)
- workers_tutorials_deploy-a-react-app.md (1)
- workers_tutorials_postgres.md (1)
- workers_observability.md (1)
- workers_observability_logging.md (1)
- workers_observability_errors.md (1)
- workers_observability_logpush.md (1)
- workers_runtime-apis.md (1)
- workers_runtime-apis_fetch.md (1)
- workers_runtime-apis_request.md (1)
- workers_runtime-apis_response.md (1)
- workers_runtime-apis_headers.md (1)
- workers_runtime-apis_websockets.md (1)
- workers_runtime-apis_encoding.md (1)
- workers_runtime-apis_html-rewriter.md (1)
- workers_runtime-apis_kv.md (1)
- workers_runtime-apis_r2.md (1)

## D1 Database
- d1.md (2)
- d1_get-started.md (2)
- d1_configuration.md (2)
- d1_reference.md (1)
- d1_platform.md (1)
- d1_platform_limits.md (1)
- d1_platform_pricing.md (1)
- d1_worker-api.md (2)
- d1_worker-api_d1-database.md (1)

## Durable Objects
- durable-objects.md (1)
- durable-objects_get-started.md (1)
- durable-objects_api.md (1)
- durable-objects_api_id.md (1)
- durable-objects_api_stub.md (1)
- durable-objects_api_state.md (1)
- durable-objects_api_websockets.md (1)
- durable-objects_api_alarms.md (1)
- durable-objects_best-practices.md (1)
- durable-objects_platform.md (1)
- durable-objects_platform_limits.md (1)
- durable-objects_platform_pricing.md (1)

## KV
- kv.md (2)
- kv_get-started.md (2)
- kv_reference.md (1)
- kv_platform.md (1)
- kv_platform_pricing.md (1)

## R2
- r2.md (2)
- r2_get-started.md (2)
- r2_api.md (1)
- r2_pricing.md (1)

## Vectorize
- vectorize.md (1)
- vectorize_get-started.md (1)
- vectorize_configuration.md (1)
- vectorize_reference.md (1)
- vectorize_platform.md (1)
- vectorize_platform_pricing.md (1)

## Workers AI
- workers-ai.md (1)
- workers-ai_get-started.md (1)
- workers-ai_configuration.md (1)
- workers-ai_configuration_open-ai-compatibility.md (1)
- workers-ai_models.md (1)
- workers-ai_models_embedding.md (1)
- workers-ai_platform.md (1)
- workers-ai_platform_limits.md (1)
- workers-ai_platform_pricing.md (1)

## Queues
- queues.md (1)
- queues_get-started.md (1)
- queues_configuration.md (1)
- queues_reference.md (1)
- queues_platform.md (1)
- queues_platform_pricing.md (1)

## React
- https___react_dev_learn.md (1)
- https___react_dev_learn_thinking-in-react.md (1)
- https___react_dev_reference_react_hooks.md (1)
- https___react_dev_reference_react_useState.md (1)
- https___react_dev_reference_react_useEffect.md (1)
- https___react_dev_reference_react_useMemo.md (1)
- https___react_dev_reference_react_useCallback.md (1)
- https___react_dev_reference_react_useContext.md (1)
- context7-hooks-patterns.md (5)

## Next.js
- https___nextjs_org_docs.md (1)
- https___nextjs_org_docs_getting-started.md (1)
- https___nextjs_org_docs_app_building-your-application.md (1)
- https___nextjs_org_docs_app_building-your-application_routing.md (1)
- https___nextjs_org_docs_app_building-your-application_rendering.md (1)
- https___nextjs_org_docs_app_building-your-application_data-fetching.md (1)
- context7-server-actions.md (5)

## TypeScript
- https___www_typescriptlang_org_docs_handbook_2_generics_html.md (1)
- https___www_typescriptlang_org_docs_handbook_2_types-from-types_html.md (1)
- https___www_typescriptlang_org_docs_handbook_2_conditional-types_html.md (1)
- https___www_typescriptlang_org_docs_handbook_2_mapped-types_html.md (1)
- context7-utility-types.md (5)

## Hono
- https___hono_dev.md (1)
- https___hono_dev_docs_getting-started_basic.md (1)
- https___hono_dev_docs_api_hono.md (1)
- https___hono_dev_docs_api_request.md (1)
- https___hono_dev_docs_guides_middleware.md (1)
- context7-routing-middleware.md (6)

## Vitest
- https___vitest_dev.md (1)
- https___vitest_dev_guide.md (1)
- https___vitest_dev_config.md (1)
- https___vitest_dev_guide_features_html.md (1)
- https___vitest_dev_guide_cli_html.md (1)
- context7-mocking-patterns.md (5)

## Drizzle ORM
- https___orm_drizzle_team_docs_overview.md (1)
- https___orm_drizzle_team_docs_get-started.md (1)
- https___orm_drizzle_team_docs_relations.md (1)
- https___orm_drizzle_team_docs_insert.md (1)
- https___orm_drizzle_team_docs_delete.md (1)

## Prisma
- https___www_prisma_io_docs.md (1)
- https___www_prisma_io_docs_getting-started.md (1)
- https___www_prisma_io_docs_concepts.md (1)

## PostgreSQL
- https___www_postgresql_org_docs_current_indexes_html.md (1)
- https___www_postgresql_org_docs_current_datatype-json_html.md (1)
- https___www_postgresql_org_docs_current_plpgsql_html.md (1)

## Redis
- https___redis_io_docs.md (1)
- https___redis_io_docs_commands.md (1)

## tRPC
- https___trpc_io_docs.md (1)
- https___trpc_io_docs_getting-started.md (1)
- https___trpc_io_docs_router.md (1)
- https___trpc_io_docs_procedures.md (1)

## Tree-sitter
- https___tree-sitter_github_io_tree-sitter.md (1)
- https___tree-sitter_github_io_tree-sitter_using-parsers.md (1)

## OpenAI API
- https___platform_openai_com_docs_api-reference.md (1)
- https___platform_openai_com_docs_guides_embeddings.md (1)
- https___platform_openai_com_docs_guides_text-generation.md (1)

## C#
- https___learn_microsoft_com_en-us_dotnet_csharp.md (1)
- https___learn_microsoft_com_en-us_dotnet_csharp_programming-guide_concepts_async.md (1)
- https___learn_microsoft_com_en-us_dotnet_csharp_programming_guide_generics.md (1)
- https___learn_microsoft_com_en-us_dotnet_csharp_language-reference_keywords.md (1)

## C++
- https___isocpp_org_get-started.md (1)
- https___isocpp_org_wiki_faq.md (1)
- https___en_cppreference_com_w_cpp.md (1)

## Unity (base)
- https___docs_unity3d_com_Manual_Components_html.md (1)
- https___docs_unity3d_com_Manual_UIElements_html.md (1)
- https___docs_unity3d_com_Manual_com_unity_addressables_html.md (1)

## Unity Entities (ECS) — deepened (17 chunks)
- context7-ecs-basics.md (6) — original
- https___docs_unity3d_com_Packages_com_unity_entities_latest.md (1) — original
- context7-ecs-deepen.md (10) — new (batch 4b)

## Unity Cinemachine — deepened (12 chunks)
- https___docs_unity3d_com_Packages_com_unity_cinemachine_latest.md (1) — original
- https___docs_unity3d_com_Packages_com_unity_cinemachine_3_1_manual_index_html.md (1) — new (batch 4b)
- https___docs_unity3d_com_Packages_com_unity_cinemachine_3_1_manual_CinemachineImpulse_html.md (1) — new
- context7-cinemachine-deepen.md (9) — new (batch 4b)

## Unity Netcode for GameObjects — NEW (17 chunks, batch 4)
- context7-netcode-basics.md (7) — Context7
- https___docs_unity3d_com_Packages_com_unity_netcode_gameobjects_2_11_manual_*.md (6) — Unity docs

## Unity Shaders — NEW (8 chunks, batch 4)
- context7-shaders-basics.md (3) — Context7
- https___docs_unity3d_com_Manual_SL-*.md (3) — Unity docs

## shadcn/ui — NEW (17 chunks, batch 4)
- context7-shadcn-basics.md (7) — Context7
- https___ui_shadcn_com_docs_components_*.md (9) — shadcn docs

## NativeWind — NEW (11 chunks, batch 4)
- context7-nativewind-basics.md (2) — Context7
- https___www_nativewind_dev_*.md (1) — NativeWind docs

## GitHub Actions — NEW (16 chunks, batch 4)
- context7-actions-basics.md (1) — Context7
- https___docs_github_com_en_actions_*.md (7) — GitHub docs

## bolt.new — NEW (7 chunks, batch 5) — `knowledge/bolt/`
- context7-bolt-basics.md (1) — Context7
- https___bolt_new.md (1) — Scraped

## shieldcn — NEW (7 chunks, batch 5) — `knowledge/shieldcn/`
- context7-shieldcn-basics.md (1) — Context7 (SPA, not scrapeable)

## Unreal Engine
- https___docs_unrealengine_com_5_0_en-US_blueprints-visual-scripting-in-unreal-engine.md (1)

---

# Batch 1 — Word-guess / mobile stack (**in D1**)

Local index stats (chunks / vectors exported):

| Topic | Chunks | Vectors |
|-------|--------|---------|
| expo | 23 | 23 |
| firebase | 20 | 18 |
| google-cloud-thin | 5 | 5 |
| react-native | 11 | 11 |
| kotlin | 8 | 8 |
| monetization-iap | 24 | 23 |
| play-console | 3 | 3 |
| apple-gamecenter-iap | 5 | 5 |
| rn-tooling | 15 | 15 |

## Expo + EAS — `knowledge/expo/` (14 files)
- context7-eas-cli.md
- context7-env-and-eas-config.md
- https___docs_expo_dev.md
- https___docs_expo_dev_build_introduction.md
- https___docs_expo_dev_build_setup.md
- https___docs_expo_dev_develop_development-builds_introduction.md
- https___docs_expo_dev_eas.md
- https___docs_expo_dev_eas-update_introduction.md
- https___docs_expo_dev_get-started_create-a-project.md
- https___docs_expo_dev_get-started_introduction.md
- https___docs_expo_dev_guides_environment-variables.md
- https___docs_expo_dev_submit_introduction.md
- https___docs_expo_dev_versions_latest.md
- https___docs_expo_dev_workflow_overview.md

## Firebase — `knowledge/firebase/` (13 files)
- context7-firestore-rules.md
- context7-rnfirebase-modular.md
- https___firebase_google_com_docs.md
- https___firebase_google_com_docs_android_setup.md
- https___firebase_google_com_docs_auth.md
- https___firebase_google_com_docs_auth_android_start.md
- https___firebase_google_com_docs_auth_ios_start.md
- https___firebase_google_com_docs_firestore.md
- https___firebase_google_com_docs_firestore_quickstart.md
- https___firebase_google_com_docs_firestore_security_get-started.md
- https___firebase_google_com_docs_ios_setup.md
- https___firebase_google_com_docs_remote-config.md
- https___firebase_google_com_docs_remote-config_get-started.md

## Google Cloud (thin) — `knowledge/google-cloud-thin/` (5 files)
- https___cloud_google_com_apis_docs_getting-started.md
- https___cloud_google_com_docs_authentication.md
- https___cloud_google_com_docs_overview.md
- https___cloud_google_com_iam_docs_service-account-overview.md
- https___cloud_google_com_resource-manager_docs_creating-managing-projects.md

## React Native — `knowledge/react-native/` (9 files)
- context7-networking-forms.md
- https___reactnative_dev_docs_components-and-apis.md
- https___reactnative_dev_docs_debugging.md
- https___reactnative_dev_docs_environment-setup.md
- https___reactnative_dev_docs_getting-started.md
- https___reactnative_dev_docs_navigation.md
- https___reactnative_dev_docs_network.md
- https___reactnative_dev_docs_security.md
- https___reactnative_dev_docs_typescript.md

## Kotlin (light) — `knowledge/kotlin/` (6 files)
- context7-basics.md
- https___developer_android_com_kotlin.md
- https___kotlinlang_org_docs_basic-syntax_html.md
- https___kotlinlang_org_docs_classes_html.md
- https___kotlinlang_org_docs_coroutines-overview_html.md
- https___kotlinlang_org_docs_getting-started_html.md

## Monetization (IAP / RevenueCat / AdMob) — `knowledge/monetization-iap/` (11 files)
- context7-admob.md
- context7-react-native-iap.md
- context7-revenuecat-rn.md
- https___developer_android_com_google_play_billing.md
- https___developer_android_com_google_play_billing_integrate.md
- https___developer_android_com_google_play_billing_security.md
- https___developers_google_com_admob_android_quick-start.md
- https___developers_google_com_admob_ios_quick-start.md
- https___www_revenuecat_com_docs_getting-started_installation_expo.md
- https___www_revenuecat_com_docs_getting-started_installation_reactnative.md
- https___www_revenuecat_com_docs_welcome_overview.md

## Play Console — `knowledge/play-console/` (3 files)
- https___developer_android_com_distribute_console.md
- https___support_google_com_googleplay_android-developer_answer_9859152.md
- https___support_google_com_googleplay_android-developer_answer_9859348.md

## Apple Game Center + StoreKit IAP — `knowledge/apple-gamecenter-iap/` (5 files)
- https___developer_apple_com_documentation_gamekit.md
- https___developer_apple_com_documentation_storekit.md
- https___developer_apple_com_documentation_storekit_in-app_purchase.md
- https___developer_apple_com_game-center.md
- https___developer_apple_com_in-app-purchase.md

## RN tooling (Zustand / Maestro / Jest / RNTL) — `knowledge/rn-tooling/` (8 files)
- context7-maestro.md
- context7-zustand.md
- https___callstack_github_io_react-native-testing-library_docs_start_quick-start.md
- https___docs_maestro_dev.md
- https___docs_maestro_dev_api-reference_commands.md
- https___docs_maestro_dev_getting-started_installing-maestro.md
- https___jestjs_io_docs_getting-started.md
- https___jestjs_io_docs_tutorial-react-native.md

### Scrape notes
- Zustand official site scrape failed (SPA) — covered via Context7
- `react-native-iap` docs.page URL failed — covered via Context7 `/hyochan/react-native-iap`
- Some Apple developer.doc pages returned thin HTML (~882 chars) — keep; deepen later if needed
- One Play Console support URL failed (1153488)

---

# Batch 2 — Portfolio / SCE glue (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|---------|
| tailwind-css | 4 | 4 |
| resend | 5 | 5 |
| vercel | 5 | 5 |
| t3-env | 4 | 4 |
| zod | 4 | 3 |
| drizzle-neon | 12 | 12 |
| fastapi-python | 10 | 10 |
| docker-ngrok | 7 | 6 |

## Tailwind CSS v4 — `knowledge/tailwind-css/` (1 file)
- context7-v4-install.md
- Note: official Tailwind HTML scrapes were 180–970KB noise dumps; removed. Prefer Context7.

## Resend — `knowledge/resend/` (5 files)
- context7-send-email.md
- https___resend_com_docs_api-reference_emails_send-email.md
- https___resend_com_docs_dashboard_domains_introduction.md
- https___resend_com_docs_introduction.md
- https___resend_com_docs_send-with-nodejs.md

## Vercel — `knowledge/vercel/` (5 files)
- https___vercel_com_docs.md
- https___vercel_com_docs_deployments_overview.md
- https___vercel_com_docs_environment-variables.md
- https___vercel_com_docs_frameworks_nextjs.md
- https___vercel_com_docs_getting-started-with-vercel.md

## t3-env — `knowledge/t3-env/` (4 files)
- context7-nextjs.md
- https___env_t3_gg_docs_customization.md
- https___env_t3_gg_docs_introduction.md
- https___env_t3_gg_docs_nextjs.md

## Zod — `knowledge/zod/` (4 files)
- context7-basics.md
- https___zod_dev.md
- https___zod_dev_api.md
- https___zod_dev_basics.md

## Drizzle + Neon — `knowledge/drizzle-neon/` (9 files)
- context7-neon-connect.md
- https___neon_tech_docs_connect_connect-from-any-app.md
- https___neon_tech_docs_get-started-with-neon_signing-up.md
- https___neon_tech_docs_introduction.md
- https___orm_drizzle_team_docs_connect-neon.md
- https___orm_drizzle_team_docs_get-started_neon-new.md
- https___orm_drizzle_team_docs_migrations.md
- https___orm_drizzle_team_docs_rqb.md
- https___orm_drizzle_team_docs_sql-schema-declaration.md

## FastAPI + Python — `knowledge/fastapi-python/` (8 files)
- context7-deps-params.md
- https___docs_python_org_3_tutorial_index_html.md
- https___fastapi_tiangolo_com_tutorial.md
- https___fastapi_tiangolo_com_tutorial_body.md
- https___fastapi_tiangolo_com_tutorial_dependencies.md
- https___fastapi_tiangolo_com_tutorial_first-steps.md
- https___fastapi_tiangolo_com_tutorial_path-params.md
- https___fastapi_tiangolo_com_tutorial_query-params.md

## Docker + ngrok — `knowledge/docker-ngrok/` (7 files)
- https___docs_docker_com_compose.md
- https___docs_docker_com_compose_compose-file.md
- https___docs_docker_com_engine_reference_builder.md
- https___docs_docker_com_get-started_overview.md
- https___ngrok_com_docs_agent.md
- https___ngrok_com_docs_getting-started.md
- https___ngrok_com_docs_http.md

---

# Batch 3 — SCE platform tooling (**in D1**)

| Topic | Chunks | Vectors |
|-------|--------|---------|
| wrangler | 5 | 4 |
| openrouter | 4 | 3 |
| mcp | 6 | 6 |
| sqlite (deepen) | 6 | 3 |

## Wrangler — `knowledge/wrangler/` (5 files)
- workers_testing_vitest-integration.md
- workers_wrangler.md
- workers_wrangler_commands.md
- workers_wrangler_configuration.md
- workers_wrangler_install-and-update.md

## OpenRouter — `knowledge/openrouter/` (4 files)
- https___openrouter_ai_docs_api-reference_overview.md
- https___openrouter_ai_docs_guides_overview_models.md
- https___openrouter_ai_docs_guides_routing_provider-selection.md
- https___openrouter_ai_docs_quickstart.md

## MCP — `knowledge/mcp/` (5 files)
- context7-typescript-server.md
- https___modelcontextprotocol_io_docs_getting-started_intro.md
- https___modelcontextprotocol_io_docs_learn_architecture.md
- https___modelcontextprotocol_io_docs_learn_server-concepts.md
- https___modelcontextprotocol_io_specification_2025-03-26.md

## SQLite deepen — `knowledge/sqlite/` (added)
- https___www_sqlite_org_lang_html.md
- https___www_sqlite_org_fts5_html.md (~155KB — keep for FTS5)
- https___github_com_WiseLibs_better-sqlite3.md (README usage section)

## Own-repo corpora
- **Imported** — see Batch 3b stats above

---

# Batch 3b — Own-repo corpora (**in D1**)

| Corpus | Path | Chunks | Vectors | Symbols |
|--------|------|--------|---------|---------|
| SCE packages | `packages/` | 290 | 290 | 265 |
| word-guess | `E:\Projects\Indie\word-guess` | 423 | 423 | 287 |
| web-portfolio | `E:\Projects\Web\web-portfolio` | 155 | 155 | 61 |
| **Subtotal** | | **868** | **868** | **613** |

Configs: `packages/sce.config.json`, `word-guess/sce.config.json`, `web-portfolio/sce.config.json`  
Local indexes live in each project’s `.sce/` (gitignored in SCE; add `.sce/` to the other repos if not already).

---

# Batch 7 — UI libraries (**in D1**)

## RetroUI — `knowledge/retroui/` (65 files, 124 chunks)

Scraped from https://retroui.dev/docs via custom RSC-aware scraper.

- **Core docs**: introduction, installation (Next.js, Vite), MCP server, changelog
- **Components** (57): accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, checkbox, collapsible, command, combobox, context-menu, data-table, date-picker, dialog, direction, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, menubar, navigation-menu, native-select, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip, typography
- **Scrape method**: Custom `rsc-scraper.ts` — extracts content from Next.js React Server Component `__next_f.push` script chunks
- **Note**: toast component page returned 404 (not yet published)

---

# Batch 33 — ZLinq Deep Scrape (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| zlinq (new) | 139 | 139 | **Deep scrape from Cysharp/ZLinq GitHub**: Architecture & design, Getting started, Complete operators reference (99% .NET 10 compat), LINQ to SIMD guide, LINQ to Tree (FileSystem, JSON, GameObjects), Unity integration guide, ZLinq vs System.Linq comparison, plus 47 C# source files from `src/ZLinq/Linq/` |
| **Total** | **139** | **139** |

### Notes
- Replaces thin `context7-zlinq-basics.md` (was 1 chunk) with comprehensive 139-chunk deep reference
- Original `linq` topic (12 chunks) retained for standard C# LINQ reference
- Covers: zero-allocation architecture, ValueEnumerable<T>, IValueEnumerator<T>, all operators, SIMD operations, Unity/DOTS/Burst integration, LINQ to Tree, UniTask/DOTween integration
- Source files include: Where, Select, OrderBy, GroupBy, Join, Aggregate, First, Any, Count, Sum, Average, Distinct, Skip, Take, ToArray, ToList, Concat, Zip, Reverse, Range, Sequence, Shuffle, LeftJoin, RightJoin, AggregateBy, CountBy, Chunk, Except, Intersect, Union, Append, Prepend, Single, Last, ElementAt, Min, Max, CopyTo, AsValueEnumerable, ForEach, ToArrayPool, JoinToString, Pinned, ToImmutableArray

# Batch 32 — Minimalist UI CSS Frameworks (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| pico-css (new) | 3 | 3 | Classless semantic CSS, dark mode, SASS customization, responsive |
| watercss (new) | 9 | 9 | Classless CSS, CSS variables, theme switching, dark/light modes |
| mvp-css (new) | 3 | 3 | Classless CSS for MVP landing pages, CSS variables |
| new-css (new) | 9 | 9 | Classless CSS framework, responsive, dark mode |
| radix-themes (new) | 286 | 270 | Unstyled React primitives (button, card, dialog, tabs, select, checkbox, switch, etc.) |
| **Total** | **310** | **294** |

### Notes
- watercss, new-css: SPA sites, used Context7 for documentation
- pico-css: Partial scrape (3/7 pages), supplemented with Context7
- mvp-css: Full scrape from GitHub Pages + GitHub repo
- radix-themes: Large component library (18 components), full scrape from radix-ui.com
- radix-themes vectors may still be importing to D1 (286 chunks, 270 vectors)

---

# Batch 31 — Design Patterns (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| design-patterns (new) | 127 | 127 | Mobile UI patterns (onboarding, login, home, feed, detail, profile, settings, navigation, input, feedback, media, commerce, social), Material Design 3 components (buttons, cards, chips, navigation, text fields, sliders, dialogs, snackbars), Apple HIG iOS patterns (nav bars, tab bars, alerts, sheets, lists, forms, dark mode, layout), UI-Patterns.com catalog |
| **Total** | **127** | **127** |

### Notes
- Content is text-based pattern descriptions (not images) — Mobbin-style visual references not available for scraping
- Material Design 3 JS-rendered, used Context7 for component specs
- Apple HIG scraped via Context7
- UI-Patterns.com scraped for pattern categories

---

# Batch 30 — Unity UI (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| unity-ui (new) | 92 | 92 | UGUI (Canvas, RectTransform, Image, Text, Button, Toggle, Slider, ScrollRect, Scrollbar, CanvasScaler, GraphicRaycaster, EventSystem, Layout groups, Rich Text), UI Toolkit (VisualElement, USS/UXML, UI Builder, data binding, manipulators, scheduling, panels), TextMeshPro (TMP_Text, TMP_InputField, font assets, rich text tags, mesh modifiers) |
| **Total** | **92** | **92** |

### Notes
- Scraped from `com.unity.ugui@2.0`, `com.unity.textmeshpro@3.2`, and 6000.3 Manual pages
- Deep reference files created for UGUI, UI Toolkit, and TextMeshPro
- Replaces thin `unity-ui-toolkit` (2 chunks) with comprehensive coverage

---

# Batch 29 — Unity Cloud + GCP deepen + Splines (**in D1**)

| Topic | Chunks | Vectors | Notes |
|-------|--------|---------|-------|
| unity-cloud (new) | 87 | 75 | Cloud Save, Analytics, Remote Config, Leaderboards, Multiplayer (Sessions, Matchmaker, Relay), Economy, Authentication, Vivox, LevelPlay, Deployment, Building Blocks |
| google-cloud-thin (deepen) | 185 | 182 | **Deepened from 5→185**: Compute Engine, Cloud Run, Cloud Functions, Cloud Storage, Cloud SQL (MySQL/Postgres), Firestore, Bigtable, Pub/Sub, Cloud Tasks, GKE, Cloud Build, Cloud Logging, Monitoring, Secret Manager, Endpoints, API Gateway, Cloud CDN, Load Balancing, VPC & Firewalls, IAM & Service Accounts, Cloud Scheduler, Deployment Manager, Source Repos |
| spline (deepen) | 6 | 6 | **Deepened**: Unity Splines package (SplineContainer, BezierKnot, CatmullRomKnot, LinearKnot, SplineAnimate, SplineInstantiate, SplineMesh, SplineExtrude, SplineCompositor, evaluation, distance, jobs) + generic Bezier/Catmull-Rom math |
| **Total** | **278** | **263** |

### Notes
- Unity Cloud docs have non-standard URL patterns (some pages 404); used Context7 + manual content for deep references
- GCP scraper: 60/73 pages scraped (some JS-rendered pages returned minimal content)
- All three topics indexed locally and imported to D1 via `--append`

