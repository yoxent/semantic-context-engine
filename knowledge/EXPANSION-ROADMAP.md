# Knowledge Base Expansion Roadmap

**Created**: 2026-07-18
**Total Topics Planned**: ~100+
**Status**: Planning / Queued

---

## Current State

- **D1 Live**: 1795 chunks, 1748 vectors, 86 topics
- **Indexed**: Cloudflare suite, React/Next.js, TypeScript, Hono, Vitest, Unity (base + ECS + Cinemachine + Netcode + Shaders), Mobile (Expo, Firebase, RN, Kotlin), Backend (Express, FastAPI), DB (Postgres, Redis, Drizzle, Prisma), DevOps, C#/.NET, RetroUI, Dot Matrix, filestream, scientific-notation

---

## Batch 10 — Unity Particle Systems

| Topic | Scope |
|-------|-------|
| Particle System (Shuriken) | Emission, Shape, Velocity, Color over Lifetime, Size, Collision, Sub Emitters, Trails |
| VFX Graph | GPU-based particles, visual effect assets, operators, contexts (Spawn, Initialize, Update, Output) |
| VFX Graph vs Particle System | When to use which, performance tradeoffs |
| VFX Graph Custom Operators | HLSL blocks, custom shaders, SDF |
| Particle Collision | World collisions, local collisions, particle forces |
| Sub Emitters | Trigger-based, birth, death, collision sub emitters |
| Particle Trails | Trail renderer, custom trail textures, ribbon trails |
| Particle Lights | Spot/point lights per particle, light cookies |
| Mesh Particles | Emitting from meshes, skinned mesh emission |
| Texture Sheet Animation | Sprite sheets, flipbook animation |
| VFX Graph GPU Events | GPU-driven spawn, output event handlers |
| Culling & LOD | VFX culling, LOD groups for effects |

---

## Batch 11 — Unity Effects & Post-Processing

| Topic | Scope |
|-------|-------|
| URP Post Processing | Volume framework, global vs local volumes, priority |
| HDRP Post Processing | Same framework, HDRP-exclusive effects |
| Common Effects | Bloom, DOF, Motion Blur, Color Grading, Tonemapping |
| Custom Post Processing | ScriptableRenderPass, custom volume components |
| Render Features | URP Render Objects, custom render passes |
| Screen Space Effects | SSAO, SSR, Screen Space Shadows |
| Decals | Projector decal, decal shader graph, deferred decals |
| Fog | Volumetric fog, height fog, atmospheric scattering |
| Outlines | Inverted hull, edge detection, post-process outlines |
| Dissolve / Hologram | Shader-based effects, edge glow |
| Distortion | Grab pass, refraction, heat haze |
| Particle + Shader Combo | Combining VFX with custom shader effects |

---

## Batch 12 — Unity Build & Profiles

| Topic | Scope |
|-------|-------|
| Build Profiles (Unity 6) | Per-platform profiles, scene list, settings |
| Build Configuration | Debug vs Release, IL2CPP vs Mono, scripting backend |
| Addressables Build | Build remote/local, content update, catalog |
| Build Automation | BuildPipeline API, command line builds, CI/CD |
| Asset Bundles | Legacy bundle system, manifest, compression |
| Build Stripping | Managed code stripping, link.xml, engine code stripping |
| Platform Settings | Android min API, iOS target, texture compression |
| Build Reports | Size analysis, asset import logs |
| Code Signing | Android keystore, iOS provisioning profiles |
| Incremental Builds | Cache server, Accelerator, build caching |

---

## Batch 13 — Unity 6.0

| Topic | Scope |
|-------|-------|
| What's New in Unity 6 | LTS release, versioning changes, migration |
| Unity 6 Rendering | GPU Resident Drawer, Batch Rendering, URP improvements |
| GPU Resident Drawer | GPU-driven rendering, indirect draw, culling |
| Spatial Tweens | New tween system |
| Unity 6 UI | UI Toolkit improvements, runtime bindings |
| Multiplayer Services | Unity lobby, relay, matchmaker updates |
| Unity Sentis | Run ML models in-game, ONNX support, inference |
| Performance Improvements | Startup time, memory, profiling tools |
| New Input System Updates | Enhanced touch, pen, gamepad support |
| Platform Updates | visionOS support, Meta Quest updates |
| Scripting Changes | API changes, deprecations, new APIs |

---

## Batch 14 — Unity Collisions & Physics ✅ DONE

| Topic | Scope |
|-------|-------|
| Collider Types | Box, Sphere, Capsule, Mesh (convex vs non-convex) |
| Triggers vs Colliders | OnTriggerEnter, OnTriggerStay, OnTriggerExit |
| Collision Matrix | Layer-based filtering, Physics settings |
| Physics Materials | Bounciness, friction, combine modes |
| Raycasting | Raycast, SphereCast, BoxCast, RaycastAll |
| Physics Queries | OverlapSphere, OverlapBox, CheckBox, Linecast |
| Collision Events | OnCollisionEnter/Stay/Exit vs Trigger variants |
| Layer Setup | Layer masks, tag vs layer, collision layer matrix |
| 2D Collisions | Circle, Box, Polygon, Capsule 2D colliders |
| Collision Detection Modes | Discrete, Continuous, Continuous Dynamic |
| Physics Debug | Gizmos, Physics Debugger window |

---

## Batch 15 — Unity Springs & Joints ✅ DONE

| Topic | Scope |
|-------|-------|
| SpringJoint | Connect two Rigidbodies, spring force, damper |
| ConfigurableJoint | Linear/C angular springs, drives, limits |
| Position Drive | Spring + damper on x/y/z, target rotation |
| Rotation Drive | Angular X/Y/Z drive, slerp drive |
| Practical Springs | Bouncy platforms, camera follow, ragdoll recovery |
| Soft Body Simulation | Spring mesh, procedural deformation |
| HingeJoint | Door, lever, rotating platforms |
| FixedJoint | Glue objects together, break force |
| SliderJoint | Linear motion along axis |
| CharacterJoint | Ragdoll, limited rotation |
| Joint Motor | HingeJoint motor, speed vs torque |
| Joint Limits | Min/max angle, min/max distance |
| Breakable Joints | breakForce, breakTorque, OnJointBreak |
| 2D Joints | Distance, Hinge, Slider, Wheel, AreaEffector, BuoyancyEffector |
| Joint Setup Patterns | Ragdoll, vehicle suspension, chains |

---

## Batch 16 — Unity Primitives & Meshes ✅ DONE

| Topic | Scope |
|-------|-------|
| Built-in Primitives | Cube, Sphere, Capsule, Cylinder, Plane, Quad |
| Primitive Mesh Data | MeshFilter.mesh, vertices, triangles, normals |
| Procedural Meshes | Generating meshes at runtime, Mesh API |
| Primitive Variants | Rounded cube, low-poly sphere, hex grid |
| Mesh Combiner | Combine meshes, reduce draw calls |
| Runtime Instantiation | Instantiate, ObjectPool, prefab variants |
| Custom Mesh Import | FBX, OBJ, glTF, runtime loading |
| Mesh Optimization | LOD, mesh compression, vertex caching |

---

## Batch 17 — Unity Renderers

| Topic | Scope |
|-------|-------|
| MeshRenderer | Materials, shared vs instance, rendering layers |
| SkinnedMeshRenderer | Bones, blend shapes, mesh skinning |
| SpriteRenderer | 2D sprites, sorting layers, flip, tile mode |
| TrailRenderer | Time-based trails, width curve, color gradient |
| ParticleSystemRenderer | Particle rendering, mesh particles, ribbons |
| RenderQueue | Sorting, z-test, z-write, transparency |
| GPU Instancing | DrawMeshInstanced, indirect, batch rendering |
| LOD Group | LOD levels, screen transition, fade modes |
| Renderer Features | URP render objects, custom passes |
| Dynamic Batching | Static vs dynamic, batching rules |
| Occlusion Culling | Baked vs dynamic, portals |

---

## Batch 18 — Unity Camera

| Topic | Scope |
|-------|-------|
| Camera Basics | FOV, near/far clip, orthographic vs perspective |
| Camera Setup | Viewport, rect, depth, culling mask |
| Cinemachine FreeLook | Third-person orbit camera, mouse/touch input |
| Cinemachine Virtual Camera | Follow, look at, noise, aim |
| Camera Stacking | Multiple cameras, overlays (URP) |
| Render Texture | Camera to texture, mirrors, CCTV, minimap |
| Camera Effects | Shake, zoom, dolly, pan |
| Camera Confiner | Cinemachine Confiner, 2D bounds |
| First Person Camera | Mouse look, head bob, smooth follow |
| Third Person Camera | Orbit, shoulder cam, collision avoidance |

---

## Batch 19 — Unity Scene Management

| Topic | Scope |
|-------|-------|
| SceneManager | LoadScene, LoadSceneAsync, UnloadScene |
| Scene Transitions | Fade, slide, loading screen patterns |
| DontDestroyOnLoad | Persistent objects across scenes |
| Scene Single vs Additive | When to use which |
| Scene Build Settings | Scene list, build index, platform scenes |
| Async Loading | AllowSceneActivation, progress, completion callback |
| Scene Dependencies | Asset references across scenes |
| Scene Unloading | When to unload, memory considerations |
| Additive Scene Loading | LoadSceneMode.Additive, scene stacking |
| Scene Composition | Base scene + gameplay scenes + UI scene |
| Lighting in Additive | Baked lighting, reflection probes per scene |
| NavMesh in Additive | Multiple NavMeshes, NavMeshSurface |
| Audio in Additive | Audio listeners, audio sources per scene |
| Addressable Scenes | Loading scenes via addressables |

---

## Batch 20 — Unity Interfaces

| Topic | Scope |
|-------|-------|
| C# Interfaces in Unity | MonoBehaviour implementing interfaces |
| IPointerClickHandler | UI events, OnPointerClick, OnPointerDown |
| IDragHandler, IBeginDragHandler | Drag and drop, UI and world space |
| IPointerEnterHandler | Hover detection, tooltips |
| ISubmitHandler | Button submit, input field enter |
| ISelectHandler, IDeselectHandler | UI focus events |
| Custom Interfaces | Design patterns: IDamageable, ICollectable |
| Interface vs Abstract | When to use which in Unity |

---

## Batch 21 — Unity Editor Scripting

| Topic | Scope |
|-------|-------|
| Custom Inspectors | [CustomEditor], OnInspectorGUI, DrawDefaultInspector |
| PropertyDrawer | [CustomPropertyDrawer], custom attributes |
| Editor Windows | EditorWindow, GetWindow, OnGUI |
| SerializedObject | FindProperty, ApplyModifiedProperties |
| EditorUtility | DisplayDialog, SaveFilePanel, ProgressBar |
| Editor Coroutines | Async editor operations |
| SceneView Handles | Handles.DrawHandle, Gizmos, interactive handles |
| Scriptable Wizard | ScriptableWizard, Create wizard |
| Menu Items | [MenuItem], priority, context menus |
| EditorPrefs | Persistent editor preferences |
| AssetPostprocessor | Import callbacks, texture/model settings |
| Custom Build Scripts | BuildPipeline.BuildPlayer, pre/post build |

---

## Batch 22 — Unity Player Settings

| Topic | Scope |
|-------|-------|
| Project Settings | Player, Physics, Quality, Graphics settings |
| Company / Product Name | Build identity, bundle version |
| Android Settings | Min API, target API, keystore, split APK |
| iOS Settings | Bundle ID, provisioning, signing, target device |
| Scripting Backend | Mono vs IL2CPP, managed stripping |
| Color Space | Gamma vs Linear |
| Quality Settings | Per-platform quality levels |
| Input Settings | Old vs new input system |
| Audio Settings | Default speaker mode, spatializer |
| Time Settings | Fixed timestep, max timestep |
| Physics Settings | Gravity, default material, layer matrix |

---

## Batch 23 — Unity Graphics API

| Topic | Scope |
|-------|-------|
| SystemInfo | graphicsDeviceType, SupportsRenderTextureFormat |
| Graphics Capabilities | CheckFeature, shader level, texture formats |
| Graphics API Selection | Vulkan vs OpenGL ES vs Metal |
| CommandBuffer | Low-level rendering, blit, set render target |
| Graphics.Blit | Texture copying, post-processing material |
| RenderTexture Formats | Format, depth, anti-aliasing |
| Texture Formats | RGBA32, RGB565, ASTC, ETC2, DXT |
| Compute Shaders | Dispatch, threads, buffers |
| AsyncGPUReadback | GPU → CPU data transfer |
| Texture Compression | Per-platform, crunch, ASTC blocks |

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
