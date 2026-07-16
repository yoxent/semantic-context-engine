# D1 Knowledgebase Inventory

**Last Updated**: 2026-07-16
**D1 Live Total**: **1249 chunks, 1232 vectors** (was 381 / 364 before own-repos; originally 195 / 188)
**Live**: https://sce-web.pasttime.xyz/ · **API**: https://sce-api.pasttime.xyz

## Expansion Queue (2026-07-16)

| Batch | Topics | Status |
|-------|--------|--------|
| 1a–1e | Expo/EAS, Firebase, GCP thin, RN, Kotlin, IAP/RevenueCat/AdMob, Play Console, Game Center/StoreKit, Zustand/Maestro/Jest | **Imported to D1** |
| 2 | Tailwind v4, Resend, Vercel, t3-env, Zod, Drizzle+Neon, FastAPI, Docker, ngrok | **Imported to D1** |
| 3 | Wrangler, OpenRouter, MCP SDK, SQLite deepen | **Imported to D1** |
| 3b | Own-repo corpora (SCE packages, word-guess, web-portfolio) | **Imported to D1** |
| Parked | Django/Flask, Stripe/PayPal/GoCardless, AWS/Azure/full GCP, K8s/Podman, CRMs, Electron, Postman | Do not pull |

### Import notes
- Free OpenRouter embed model rate-limited intermittently; some doc topics have fewer vectors than chunks (keyword search still works).
- Oversized scrapes (Tailwind dumps, Docker builder, SQLite FTS5) truncated or replaced with Context7 to fit D1 statement limits.
- Helper scripts: `scripts/index-knowledge-batch.mjs`, `scripts/export-import-knowledge-batch.mjs`, `scripts/index-own-corpora.mjs`

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

## Unity
- https___docs_unity3d_com_Manual_Components_html.md (1)
- https___docs_unity3d_com_Manual_UIElements_html.md (1)
- https___docs_unity3d_com_Manual_com_unity_addressables_html.md (1)
- https___docs_unity3d_com_Packages_com_unity_cinemachine_latest.md (1)
- https___docs_unity3d_com_Packages_com_unity_entities_latest.md (1)
- context7-ecs-basics.md (6)

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

| Corpus | Path | Files | Chunks | Vectors | Symbols |
|--------|------|-------|--------|---------|---------|
| SCE packages | `packages/` | 66 | 290 | 290 | 265 |
| word-guess | `E:\Projects\Indie\word-guess` | 99 | 423 | 423 | 287 |
| web-portfolio | `E:\Projects\Web\web-portfolio` | 35 | 155 | 155 | 61 |

Configs: `packages/sce.config.json`, `word-guess/sce.config.json`, `web-portfolio/sce.config.json`  
Local indexes live in each project’s `.sce/` (gitignored in SCE; add `.sce/` to the other repos if not already).


