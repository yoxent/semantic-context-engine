# D1 Knowledgebase Inventory

**Last Updated**: 2026-07-18
**D1 Live Total**: **1795 chunks, 1690 vectors** (originally 195 / 188)
**Live**: https://sce-web.pasttime.xyz/ · **API**: https://sce-api.pasttime.xyz

## Status

All planned expansion batches (1–8) plus filestream and scientific-notation are **imported to D1**. Dot Matrix now has vectors (was 0). Local re-index totals can lag D1 slightly after append imports or before a full re-export.

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
| google-cloud-thin | 5 | 5 | Project, IAM, auth APIs (not full GCP) |
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
| unity-scene-management | 0 | 0 | (empty — needs content) |
| unity-scriptable-objects | 0 | 0 | (empty — needs content) |
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
| spline | 5 | 5 | Bezier, Catmull-Rom, path following |
| filestream | 58 | 0 | Node.js fs/streams/buffer, Python file I/O |
| scientific-notation | 15 | 15 | BigInt, Number, float precision, Python decimal |
| linq | 12 | 12 | C# LINQ + ZLinq zero-alloc |
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
| **Local knowledge subtotal** | **~843** | **~829** | 86 doc topics under `knowledge/` |
| **Local grand total (incl. corpora)** | **~1685** | **~1697** | |

## Expansion Queue (2026-07-16)

| Batch | Topics | Status |
|-------|--------|--------|
| 1a–1e | Expo/EAS, Firebase, GCP thin, RN, Kotlin, IAP/RevenueCat/AdMob, Play Console, Game Center/StoreKit, Zustand/Maestro/Jest | **Imported to D1** |
| 2 | Tailwind v4, Resend, Vercel, t3-env, Zod, Drizzle+Neon, FastAPI, Docker, ngrok | **Imported to D1** |
| 3 | Wrangler, OpenRouter, MCP SDK, SQLite deepen | **Imported to D1** |
| 3b | Own-repo corpora (SCE packages, word-guess, web-portfolio) | **Imported to D1** |
| 4 | Unity Netcode, Unity Shaders, shadcn/ui, NativeWind, GitHub Actions | **Imported to D1** |
| 4b | Unity ECS deepen, Unity Cinemachine deepen | **Imported to D1** |
| 5 | shieldcn, bolt.new | **Imported to D1** |
| 6 | REST API, Flutter, Dart, Supabase, AWS Amplify, Node.js, Express, HTML, CSS, jQuery, BigQuery, CI/CD, Object Pooling, Vector Math, Spline, LINQ/ZLinq, DI, Unity ScriptableObjects, Number Formatting, Localization, Unity Events, Coroutines, Async/Awaitables, Unit Testing, Scene Management, DOTween, LitMotion, PrimeTween, zlib, Data Encryption, System.IO, Luminosity, Auth Patterns | **Imported to D1** |
| 7 | RetroUI (neobrutalist React components) | **Imported to D1** |
| 8 | Dot Matrix (loading animations) | **Imported to D1** |
| 9 | filestream (Node.js fs/streams, Python file I/O), scientific-notation (BigInt, float precision, Python decimal) | **Imported to D1** |
| 14 | Unity Collisions (colliders, triggers, raycasting) | **Imported to D1** |
| 15 | Unity Joints (springs, vehicle suspension, ragdoll) | **Imported to D1** |
| 16 | Unity Primitives (mesh API, procedural generation) | **Imported to D1** |

## Expansion Roadmap

See `knowledge/EXPANSION-ROADMAP.md` for ~100 planned topics across batches 10–23:
- **Batch 10**: Particle Systems, VFX Graph
- **Batch 11**: Post-Processing, Decals, Fog
- **Batch 12**: Build Profiles, Build Automation
- **Batch 13**: Unity 6.0, GPU Resident Drawer, Sentis
- **Batch 14**: Collisions, Raycasting
- **Batch 15**: Springs, Joints
- **Batch 16**: Primitives, Procedural Meshes
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


