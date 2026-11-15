#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = "E:/Projects/Indie/semantic-context-engine";

// Deepen topics that were backfilled and re-exported
const deepenTopics = [
  "unity-profiler-deep", "frame-debugger-deep", "gpu-optimization-deep",
  "build-size-optimization-deep", "mobile-optimization-deep",
  "game-settings-saveload-deep", "responsive-game-ui-deep", "multi-platform-input-deep",
  "game-audio-deep", "game-achievements-deep", "game-leaderboards-deep",
  "session-management-deep", "lag-compensation-deep", "state-sync-patterns-deep",
  "unreal-blueprints-deep", "unreal-game-framework-deep", "unreal-umg-ui-deep",
  "unreal-animation-deep", "unreal-niagara-deep", "unreal-chaos-deep",
  "unreal-networking-deep", "unreal-optimization-deep",
];

let missing = [];

for (const topic of deepenTopics) {
  const exportDir = join(root, "knowledge", `${topic}-export`);
  const chunks = JSON.parse(readFileSync(join(exportDir, "chunks.json"), "utf8"));
  const firstId = chunks[0].id;

  // Write SQL to a unique temp file
  const tmpDir = join(root, ".tmp-check");
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `chk-${topic}.sql`);
  writeFileSync(tmpFile, `SELECT COUNT(*) as c FROM chunks WHERE id='${firstId}'`, "utf8");

  try {
    const out = execSync(
      `npx wrangler d1 execute sce-db --remote --file="${tmpFile}"`,
      { cwd: join(root, "packages/web"), encoding: "utf8" }
    );
    const match = out.match(/"c":\s*(\d+)/);
    const found = match ? parseInt(match[1]) : 0;
    if (found === 0) {
      missing.push(topic);
      console.log(`  ✗ ${topic}: ${chunks.length}c — NOT in D1`);
    } else {
      console.log(`  ✓ ${topic}: ${chunks.length}c — in D1`);
    }
  } catch (err) {
    console.log(`  ? ${topic}: error checking (${err.message})`);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

if (missing.length > 0) {
  console.log(`\n⚠️ ${missing.length} topics MISSING from D1:`);
  missing.forEach(t => console.log(`  ${t}`));
} else {
  console.log(`\n✅ All ${deepenTopics.length} deepen topics confirmed in D1`);
}
