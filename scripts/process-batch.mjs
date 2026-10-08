#!/usr/bin/env node
/**
 * Process a single knowledge batch (scrape → index → export → import)
 * Usage: node scripts/process-batch.mjs <batch-number>
 *
 * Orchestrator creates URL files first, then calls this script per batch.
 * This script assumes URL files already exist in knowledge/urls/<topic>.txt
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Batches definition with URLs ──────────────────────────────────────────
const batches = {
  44: {
    name: "Profiling & Performance Optimization",
    topics: {
      "unity-profiler": [
        "# Unity Profiler — CPU/GPU profiling, deep profiler, profiling markers",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/Profiler.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerWindow.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerCPU.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerGPU.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerRendering.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerMemory.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerAudio.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Profiler.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Profiler.BeginSample.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Profiler.EndSample.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ProfilerRecorder.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ProfilerMarker.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Profiling.CustomSampler.html",
      ],
      "frame-debugger": [
        "# Frame Debugger — Draw call debugging, render pass analysis, SRP Batcher events",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/FrameDebugger.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/OptimizingGraphics.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/SRPBatcher.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/FrameDebugger.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rendering.CommandBuffer.html",
      ],
      "memory-profiler": [
        "# Memory Profiler — Managed/native memory analysis, GC alloc, memory leaks",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/MemoryProfiler.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnderstandingAutomaticMemoryManagement.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/DebuggingMemoryManaged.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/DebuggingMemoryNative.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/MemoryOverview.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MemoryProfiler.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Profiling.Memory.Experimental.MemoryProfilerExperimental.html",
      ],
      "gpu-optimization": [
        "# GPU Optimization — Draw call batching, SRP Batcher, GPU instancing, overdraw",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/OptimizingGraphics.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/DrawCallBatching.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/GPUInstancing.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/SRPBatcher.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ReducingOverdraw.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ResolutionScaling.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rendering.GPUInstancing.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rendering.SRPBatcher.html",
      ],
      "memory-budgeting": [
        "# Memory Budgeting — Asset budgeting, streaming, pooling, Addressables memory",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/MemoryOverview.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnderstandingAutomaticMemoryManagement.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/StreamingResources.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AddressablesMemoryManagement.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ObjectPooling.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AsyncResourceLoad.html",
      ],
      "build-size-optimization": [
        "# Build Size Optimization — Code stripping, texture/audio compression, Asset Bundles",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/BuildSettings.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ManagedCodeStripping.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/TextureCompression.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AudioCompression.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AssetBundlesIntro.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/IL2CPP.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/BuildReporting.BuildReport.html",
      ],
      "mobile-optimization": [
        "# Mobile Optimization — Battery-aware workloads, thermal throttling, overdraw",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/MobileOptimization.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/MobileBestPractice.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/OptimizingGraphics.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/ResolutionScaling.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/QualitySettings.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/QualitySettings.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ResolutionScaling.html",
      ],
    },
  },
  45: {
    name: "Game Settings, Save/Load & Responsive UI",
    topics: {
      "game-settings-saveload": [
        "# Game Settings & Save/Load — Resolution, quality, controls rebinding, save systems",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/PlayerSettings.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/QualitySettings.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/BinarySerialization.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/JSONSerialization.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/PlayerPrefs.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerSettings.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/QualitySettings.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerPrefs.html",
      ],
      "responsive-game-ui": [
        "# Responsive Game UI — CanvasScaler, safe areas, adaptive layout, orientation",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/Canvas.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/CanvasScaler.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/RectTransform.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/SafeArea.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/MultipleDisplaySupport.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AdaptiveUI.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/CanvasScaler.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Screen-safeArea.html",
      ],
      "multi-platform-input": [
        "# Multi-Platform Input — Touch, controller, keyboard, Input Action Assets",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/Input.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/InputSystem.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/TouchInput.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/GamepadSupport.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Input.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/InputSystem.html",
      ],
      "ui-animation-deepen": [
        "# UI Animation Deepen — DOTween, LitMotion, PrimeTween patterns",
        "# Unity Manual — UI Animation",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UIToolkitAnimation.html",
        "# DOTween — Official docs and context",
        "http://dotween.demigiant.com/documentation.php",
        "# PrimeTween — GitHub docs",
        "https://github.com/KyrylV/PrimeTween",
      ],
    },
  },
  46: {
    name: "Game Analytics, Audio & Achievements",
    topics: {
      "game-achievements": [
        "# Game Achievements — Cross-platform achievement systems",
        "# Steamworks",
        "https://partner.steamgames.com/doc/features/achievements",
        "https://partner.steamgames.com/doc/api/ISteamUserStats",
        "# Game Center",
        "https://developer.apple.com/documentation/gamekit/achievements",
        "# Unity",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityAnalyticsAchievements.html",
        "# Xbox",
        "https://learn.microsoft.com/en-us/gaming/gdk/_content/gc/achievements/overview",
      ],
      "game-leaderboards": [
        "# Game Leaderboards — Cross-platform leaderboard systems",
        "# Steamworks",
        "https://partner.steamgames.com/doc/features/leaderboards",
        "https://partner.steamgames.com/doc/api/ISteamUserStats",
        "# Game Center",
        "https://developer.apple.com/documentation/gamekit/leaderboards",
        "# Unity",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityAnalyticsLeaderboards.html",
      ],
      "game-analytics": [
        "# Game Analytics — Unity Analytics, GameAnalytics SDK, custom events",
        "# Unity Analytics",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityAnalytics.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AnalyticsSDK.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityAnalyticsCustomEvents.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityAnalyticsFunnels.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityAnalyticsRetention.html",
        "# GameAnalytics",
        "https://gameanalytics.com/docs/",
      ],
      "crash-reporting": [
        "# Crash Reporting — Unity Cloud Diagnostics, Crashlytics, Sentry",
        "# Unity Cloud Diagnostics",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/UnityCloudDiagnostics.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/CrashReporting.html",
        "# Firebase Crashlytics",
        "https://firebase.google.com/docs/crashlytics",
        "# Sentry for Games",
        "https://docs.sentry.io/platforms/unity/",
      ],
      "game-audio": [
        "# Game Audio — Unity Audio Mixer, spatial audio, FMOD, Wwise",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AudioMixer.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AudioSource.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/SpatialAudio.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AudioOptimization.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Audio.AudioMixer.html",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource.html",
      ],
      "addressables-deepen": [
        "# Addressables Deepen — Asset lifecycle, remote content, catalog management",
        "# Unity Manual",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/Addressables.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AddressablesAsyncOperationHandling.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AddressablesMemoryManagement.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AddressablesRemoteContent.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/AddressablesDiagnostics.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Addressables.html",
      ],
    },
  },
  47: {
    name: "Multiplayer Deepen",
    topics: {
      "session-management": [
        "# Session Management — Session create/join/resume, lobby systems, relay",
        "# Unity Netcode",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeSessionManagement.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeLobby.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeRelay.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Netcode.NetworkManager.html",
      ],
      "lag-compensation": [
        "# Lag Compensation — Client prediction, server reconciliation, rollback",
        "# Unity Netcode",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeLagCompensation.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeClientPrediction.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Netcode.NetworkTransform.html",
      ],
      "deterministic-lockstep": [
        "# Deterministic Lockstep — Fixed timestep, input queues, P2P consistency",
        "# Unity Netcode",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeDeterministic.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Netcode.NetworkManager.html",
      ],
      "state-sync-patterns": [
        "# State Sync Patterns — Delta compression, interest management, bandwidth",
        "# Unity Netcode",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeStateSync.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeInterestManagement.html",
        "https://docs.unity3d.com/6000.3/Documentation/Manual/NetcodeNetworkVariables.html",
        "# Unity Scripting API",
        "https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Netcode.NetworkVariable.html",
      ],
    },
  },
  48: {
    name: "Unreal Engine Foundation",
    topics: {
      "unreal-blueprints": [
        "# Unreal Blueprints — Visual scripting, types, event graphs, interfaces",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprints-overview",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-visual-scripting",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-types",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-event-dispatchers",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-function-libraries",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-interfaces",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-construction-scripts",
      ],
      "unreal-game-framework": [
        "# Unreal Game Framework — GameMode, GameState, PlayerController, GAS",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/game-framework",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/game-mode-and-game-state",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/player-controllers",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/pawns",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/characters",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-ability-system",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-tags",
      ],
      "unreal-umg-ui": [
        "# Unreal UMG UI — Widget Blueprint, anchoring, animation, Slate vs UMG",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/user-interface-with-umg",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/widget-types",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/widget-animation",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/umg-anchoring-and-sizing",
      ],
      "unreal-animation": [
        "# Unreal Animation — Animation Blueprints, state machines, blend spaces, IK",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-blueprints",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/state-machines",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blend-spaces",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/blend-poses",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/inverse-kinematics",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/control-rig",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/sequencer",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/root-motion",
      ],
    },
  },
  49: {
    name: "Unreal Engine Advanced",
    topics: {
      "unreal-niagara": [
        "# Unreal Niagara — VFX system, emitters, particles, GPU vs CPU, data interfaces",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-vfx-system",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-emitters",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-particles",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-data-interfaces",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-event-handling",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-scalability",
      ],
      "unreal-chaos": [
        "# Unreal Chaos — Physics, destruction, vehicles, cloth, hair",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-physics",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/destruction",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-vehicles",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-cloth",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-hair",
      ],
      "unreal-networking": [
        "# Unreal Networking — Replication, RPCs, relevancy, dedicated server",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/replication",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/rpcs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/relevancy",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/dedicated-server",
      ],
      "unreal-optimization": [
        "# Unreal Optimization — World Partition, Nanite, Lumen, LOD, profiling",
        "# Epic Docs",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/optimization",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/nanite",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/levels-of-detail",
        "https://dev.epicgames.com/documentation/en-us/unreal-engine/profiling-tools",
      ],
    },
  },

  // ── Deepen batches (corrected URLs) ──────────────────────────────────────

  50: {
    name: "Deepen: Profiling & Performance",
    topics: {
      "unity-profiler-deep": [
        "# Unity Profiler Deepen — corrected Manual URLs + Memory Profiler package",
        "https://docs.unity3d.com/Manual/Profiler.html",
        "https://docs.unity3d.com/Manual/ProfilerWindow.html",
        "https://docs.unity3d.com/Manual/ProfilerCPU.html",
        "https://docs.unity3d.com/Manual/ProfilerGPU.html",
        "https://docs.unity3d.com/Manual/ProfilerMemory.html",
        "https://docs.unity3d.com/Manual/ProfilerRendering.html",
        "https://docs.unity3d.com/Manual/ProfilerAudio.html",
        "https://docs.unity3d.com/Manual/profiler-creating-custom-counters.html",
        "https://docs.unity3d.com/Manual/profiler-add-markers-code.html",
        "https://docs.unity3d.com/Manual/profiler-memory-counters-players.html",
        "https://docs.unity3d.com/Manual/frame-timing-manager-record-timing-data.html",
        "https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html",
        "https://docs.unity3d.com/ScriptReference/Profiler.html",
        "https://docs.unity3d.com/ScriptReference/ProfilerRecorder.html",
      ],
      "frame-debugger-deep": [
        "# Frame Debugger Deepen — corrected URLs + rendering optimization",
        "https://docs.unity3d.com/Manual/FrameDebugger.html",
        "https://docs.unity3d.com/Manual/profile-rendering.html",
        "https://docs.unity3d.com/Manual/DrawCallBatching.html",
        "https://docs.unity3d.com/Manual/SRPBatcher.html",
        "https://docs.unity3d.com/Manual/GPUInstancing.html",
        "https://docs.unity3d.com/ScriptReference/FrameDebugger.html",
        "https://docs.unity3d.com/ScriptReference/Rendering.CommandBuffer.html",
      ],
      "gpu-optimization-deep": [
        "# GPU Optimization Deepen — corrected + additional Scripting API",
        "https://docs.unity3d.com/Manual/DrawCallBatching.html",
        "https://docs.unity3d.com/Manual/GPUInstancing.html",
        "https://docs.unity3d.com/Manual/SRPBatcher.html",
        "https://docs.unity3d.com/ScriptReference/Rendering.GPUInstancing.html",
        "https://docs.unity3d.com/ScriptReference/Rendering.SRPBatcher.html",
        "https://docs.unity3d.com/ScriptReference/QualitySettings.html",
      ],
      "build-size-optimization-deep": [
        "# Build Size Optimization Deepen — corrected 404s + Scripting API",
        "https://docs.unity3d.com/Manual/BuildSettings.html",
        "https://docs.unity3d.com/Manual/ManagedCodeStripping.html",
        "https://docs.unity3d.com/Manual/IL2CPP.html",
        "https://docs.unity3d.com/Manual/texture-types.html",
        "https://docs.unity3d.com/ScriptReference/BuildReporting.BuildReport.html",
        "https://docs.unity3d.com/ScriptReference/AudioCompressionFormat.html",
        "https://docs.unity3d.com/ScriptReference/PlayerSettings.html",
      ],
      "mobile-optimization-deep": [
        "# Mobile Optimization Deepen — corrected URLs",
        "https://docs.unity3d.com/Manual/UnderstandingAutomaticMemoryManagement.html",
        "https://docs.unity3d.com/Manual/DrawCallBatching.html",
        "https://docs.unity3d.com/ScriptReference/QualitySettings.html",
        "https://docs.unity3d.com/ScriptReference/PlayerSettings.html",
      ],
    },
  },

  51: {
    name: "Deepen: Settings, Save/Load & UI",
    topics: {
      "game-settings-saveload-deep": [
        "# Game Settings & Save/Load Deepen — corrected URLs",
        "https://docs.unity3d.com/Manual/JSONSerialization.html",
        "https://docs.unity3d.com/Manual/UnderstandingAutomaticMemoryManagement.html",
        "https://docs.unity3d.com/ScriptReference/PlayerPrefs.html",
        "https://docs.unity3d.com/ScriptReference/JsonUtility.html",
        "https://docs.unity3d.com/ScriptReference/PlayerSettings.html",
        "https://docs.unity3d.com/ScriptReference/QualitySettings.html",
      ],
      "responsive-game-ui-deep": [
        "# Responsive Game UI Deepen — UGUI docs + Scripting API",
        "https://docs.unity3d.com/Manual/class-Canvas.html",
        "https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/UICanvas.html",
        "https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/HOWTO-UICreateFromScripting.html",
        "https://docs.unity3d.com/ScriptReference/CanvasScaler.html",
        "https://docs.unity3d.com/ScriptReference/RectTransform.html",
        "https://docs.unity3d.com/ScriptReference/Canvas.html",
        "https://docs.unity3d.com/Manual/UIE-USS.html",
        "https://docs.unity3d.com/Manual/UIE-UXML.html",
      ],
      "multi-platform-input-deep": [
        "# Multi-Platform Input Deepen — Input System Package docs",
        "https://docs.unity3d.com/Manual/Input.html",
        "https://docs.unity3d.com/Manual/com.unity.inputsystem.html",
        "https://docs.unity3d.com/Packages/com.unity.inputsystem@1.13/manual/index.html",
        "https://docs.unity3d.com/Packages/com.unity.inputsystem@1.13/manual/QuickStartGuide.html",
        "https://docs.unity3d.com/Packages/com.unity.inputsystem@1.13/manual/ActionAssets.html",
        "https://docs.unity3d.com/Packages/com.unity.inputsystem@1.13/manual/Devices.html",
        "https://docs.unity3d.com/Packages/com.unity.inputsystem@1.13/manual/Touch.html",
        "https://docs.unity3d.com/Packages/com.unity.inputsystem@1.13/manual/Gamepad.html",
      ],
      "ui-animation-deepen": [
        "# UI Animation Deepen — additional DOTween/PrimeTween docs",
        "http://dotween.demigiant.com/documentation.php",
        "https://github.com/KyrylV/PrimeTween",
      ],
    },
  },

  52: {
    name: "Deepen: Analytics, Audio & Achievements",
    topics: {
      "game-audio-deep": [
        "# Game Audio Deepen — Audio Mixer, AudioSource, spatial audio",
        "https://docs.unity3d.com/Manual/class-AudioMixer.html",
        "https://docs.unity3d.com/Manual/class-AudioSource.html",
        "https://docs.unity3d.com/Manual/Audio.html",
        "https://docs.unity3d.com/Manual/AudioMixer.html",
        "https://docs.unity3d.com/Manual/webgl-audio.html",
        "https://docs.unity3d.com/Manual/AudioSource-reference.html",
        "https://docs.unity3d.com/ScriptReference/AudioSource.html",
        "https://docs.unity3d.com/ScriptReference/Audio.AudioMixer.html",
        "https://docs.unity3d.com/ScriptReference/AudioCompressionFormat.html",
      ],
      "addressables-deepen": [
        "# Addressables Deepen — additional package docs",
        "https://docs.unity3d.com/Packages/com.unity.addressables@2.3/manual/index.html",
        "https://docs.unity3d.com/Packages/com.unity.addressables@2.3/manual/AddressableAssetsOverview.html",
        "https://docs.unity3d.com/Packages/com.unity.addressables@2.3/manual/LoadingAddressableAssets.html",
        "https://docs.unity3d.com/Packages/com.unity.addressables@2.3/manual/MemoryManagement.html",
        "https://docs.unity3d.com/Packages/com.unity.addressables@2.3/manual/RemoteContentDistribution.html",
        "https://docs.unity3d.com/ScriptReference/Addressables.html",
      ],
      "game-achievements-deep": [
        "# Game Achievements Deepen — Steam + Apple GameKit",
        "https://partner.steamgames.com/doc/features/achievements",
        "https://partner.steamgames.com/doc/api/ISteamUserStats",
        "https://developer.apple.com/documentation/gamekit/achievements",
      ],
      "game-leaderboards-deep": [
        "# Game Leaderboards Deepen — Steam + Apple GameKit",
        "https://partner.steamgames.com/doc/features/leaderboards",
        "https://partner.steamgames.com/doc/api/ISteamUserStats",
        "https://developer.apple.com/documentation/gamekit/leaderboards",
      ],
    },
  },

  53: {
    name: "Deepen: Multiplayer / Netcode",
    topics: {
      "session-management-deep": [
        "# Session Management Deepen — Unity Netcode API",
        "https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.2/api/Unity.Netcode.NetworkManager.html",
        "https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.2/api/Unity.Netcode.NetworkBehaviour.html",
        "https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.2/api/Unity.Netcode.RpcAttribute.html",
      ],
      "lag-compensation-deep": [
        "# Lag Compensation Deepen — Netcode API",
        "https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.2/api/Unity.Netcode.NetworkTransport.html",
      ],
      "state-sync-patterns-deep": [
        "# State Sync Patterns Deepen — Netcode API",
        "https://docs.unity3d.com/Packages/com.unity.netcode.gameobjects@2.2/api/Unity.Netcode.NetworkVariable-1.html",
      ],
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function run(cmd, args, opts = {}) {
  const joined = [cmd, ...args].join(" ");
  log(`$ ${joined}`);
  // npx/cmd on Windows needs shell:true
  const useShell = opts.shell !== undefined ? opts.shell : true;
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
    shell: useShell,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ── Pipeline Steps ────────────────────────────────────────────────────────

function stepCreateUrlFile(topic, urls) {
  const urlDir = join(root, "knowledge", "urls");
  mkdirSync(urlDir, { recursive: true });
  const urlFile = join(urlDir, `${topic}.txt`);
  if (existsSync(urlFile)) {
    log(`  URL file exists: ${topic}.txt — skipping`);
    return true;
  }
  writeFileSync(urlFile, urls.join("\n") + "\n");
  log(`  Created URL file: ${topic}.txt (${urls.length} lines)`);
  return true;
}

function stepScrape(topic) {
  const urlFile = join(root, "knowledge", "urls", `${topic}.txt`);
  const outDir = join(root, "knowledge", topic);
  mkdirSync(outDir, { recursive: true });

  // Skip if already has .md files from scraping
  const existingMd = existsSync(outDir) ? readdirSync(outDir).filter(f => f.endsWith(".md")) : [];
  if (existingMd.length > 0) {
    log(`  Already has ${existingMd.length} .md files — skipping scrape`);
    return true;
  }

  const scraper = join(root, "packages", "web", "cf-scraper.ts");
  log(`  Scraping ${topic}...`);
  const result = run("npx", ["tsx", scraper, urlFile, outDir], { cwd: root });
  if (result.status !== 0) {
    log(`  ⚠️  Scrape exited ${result.status} for ${topic}, continuing...`);
    return false;
  }
  return true;
}

function stepCreateConfig(topic) {
  const topicDir = join(root, "knowledge", topic);
  const cfgPath = join(topicDir, "sce.config.json");
  if (existsSync(cfgPath)) {
    log(`  Config exists — skipping`);
    return true;
  }
  const config = {
    embedding: {
      provider: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      dimensions: 2048,
      batchSize: 1,
      apiKeyEnv: "OPENROUTER_API_KEY",
    },
    indexing: {
      include: ["**/*.md"],
      ignore: ["node_modules/**", ".git/**", ".sce/**"],
    },
    search: {
      defaultLimit: 10,
      maxSnippetChars: 500,
    },
    logging: {
      level: "info",
    },
  };
  writeFileSync(cfgPath, JSON.stringify(config, null, 2) + "\n");
  log(`  Created config`);
  return true;
}

function stepIndex(topic) {
  const topicDir = join(root, "knowledge", topic);
  const cli = join(root, "packages", "cli", "dist", "src", "main.js");
  const devVarsPath = join(root, "packages", "web", ".dev.vars");

  // Load API key
  const raw = readFileSync(devVarsPath, "utf8").trim();
  const match = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)\s*$/im);
  const key = match
    ? match[1].trim().replace(/^["']|["']$/g, "")
    : raw;

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`  Indexing ${topic} (attempt ${attempt}/${maxAttempts})...`);
    const result = run(process.execPath, [cli, "index", "."], {
      cwd: topicDir,
      env: { ...process.env, OPENROUTER_API_KEY: key },
    });
    if (result.status === 0) {
      log(`  Indexed OK`);
      return true;
    }
    const errText = `${result.stdout || ""}\n${result.stderr || ""}`;
    const retryable = /missing 'data'|HTTP 429|rate limit|temporarily|timeout/i.test(errText);
    if (!retryable) {
      log(`  ⚠️  Non-retryable error — moving on`);
      return false;
    }
    if (attempt < maxAttempts) {
      const wait = attempt * 20000;
      log(`  Retrying in ${wait}ms...`);
      sleep(wait);
    }
  }
  return false;
}

function stepExport(topic) {
  const topicDir = join(root, "knowledge", topic);
  const exportDir = join(root, "knowledge", `${topic}-export`);
  mkdirSync(exportDir, { recursive: true });
  const cli = join(root, "packages", "cli", "dist", "src", "main.js");

  // Skip if export already exists
  const existingFiles = existsSync(exportDir) ? readdirSync(exportDir).filter(f => f.endsWith(".json")) : [];
  if (existingFiles.length > 0) {
    log(`  Export exists (${existingFiles.length} files) — skipping`);
    return true;
  }

  log(`  Exporting ${topic}...`);
  const result = run(process.execPath, [cli, "export", "-o", exportDir, "--path", topicDir], { cwd: root });
  if (result.status !== 0) {
    log(`  ⚠️  Export exited ${result.status}`);
    return false;
  }
  return true;
}

function stepImport(topic) {
  const exportDir = join(root, "knowledge", `${topic}-export`);
  const webDir = join(root, "packages", "web");

  if (!existsSync(exportDir) || readdirSync(exportDir).filter(f => f.endsWith(".json")).length === 0) {
    log(`  No export files — skipping import`);
    return false;
  }

  log(`  Importing ${topic} to D1...`);
  const result = run("npx", ["tsx", "import.ts", exportDir, "sce-db", "--append"], { cwd: webDir });
  if (result.status !== 0) {
    log(`  ⚠️  Import exited ${result.status}`);
    return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  const batchNum = parseInt(process.argv[2], 10);
  if (!batchNum || !batches[batchNum]) {
    console.error(`Usage: node scripts/process-batch.mjs <batch-number>`);
    console.error(`Available batches: ${Object.keys(batches).join(", ")}`);
    process.exit(1);
  }

  const batch = batches[batchNum];
  log(`═══ Processing Batch ${batchNum}: ${batch.name} ═══`);
  log(`Topics: ${Object.keys(batch.topics).join(", ")}`);

  const results = {};

  for (const [topic, urls] of Object.entries(batch.topics)) {
    log(`\n─── Topic: ${topic} ───`);

    // Step 1: Create URL file
    log(`  [1/6] URL file...`);
    results[topic] = { url: stepCreateUrlFile(topic, urls) };

    // Step 2: Scrape
    log(`  [2/6] Scrape...`);
    const scraped = stepScrape(topic);
    results[topic].scrape = scraped;

    // Check if topic has scraped .md files
    const topicDir = join(root, "knowledge", topic);
    const mdFiles = existsSync(topicDir) ? readdirSync(topicDir).filter(f => f.endsWith(".md")) : [];
    if (mdFiles.length === 0) {
      log(`  ⚠️  No .md files for ${topic} — creating minimal fallback`);
      writeFileSync(
        join(topicDir, `${topic}.md`),
        `# ${topic}\n\n> Auto-generated from ${batch.name}\n\nSee documentation URLs in \`knowledge/urls/${topic}.txt\` for source references.\n`
      );
      mdFiles.push(`${topic}.md`);
    }

    // Step 3: Config
    log(`  [3/6] Config...`);
    results[topic].config = stepCreateConfig(topic);

    // Step 4: Index
    log(`  [4/6] Index...`);
    results[topic].index = stepIndex(topic);

    // Step 5: Export
    log(`  [5/6] Export...`);
    results[topic].export = stepExport(topic);

    // Step 6: Import to D1
    log(`  [6/6] Import...`);
    results[topic].import = stepImport(topic);

    log(`  → ${topic}: ${mdFiles.length} files`);
  }

  // Summary
  log(`\n═══ Batch ${batchNum} Summary ═══`);
  for (const [topic, steps] of Object.entries(results)) {
    const ok = Object.values(steps).filter(Boolean).length;
    const total = Object.values(steps).length;
    log(`  ${topic}: ${ok}/${total} steps OK`);
  }

  const totalOk = Object.values(results).flatMap(r => Object.values(r)).filter(Boolean).length;
  const totalSteps = Object.values(results).flatMap(r => Object.values(r)).length;
  log(`\nTotal: ${totalOk}/${totalSteps} steps OK`);

  // Exit with proper status
  const allCritical = Object.values(results).every(r => r.url && r.config && r.index && r.export && r.import);
  process.exit(allCritical ? 0 : 1);
}

main();
