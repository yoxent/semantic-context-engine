#!/usr/bin/env node
/**
 * Process Batches 54-56: Index → Export → Import newly created topics
 * Run: node scripts/process-new-batches.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

const CLIENT_ID = process.env.CLIENT_ID || "sce-cli";

// ── Batch definitions ──────────────────────────────────

const batches = {
  54: {
    name: "Random Number Generation Algorithms",
    topics: ["megarandom", "xoshiro256", "splitmix64", "pseudorandom", "game-random-utils"],
  },
  55: {
    name: "Game Development Infrastructure",
    topics: ["sprite-atlasing", "node-graphs", "storage-logic", "game-design-patterns", "net-code"],
  },
  56: {
    name: "Slay the Spire 2 & Codex",
    topics: ["slay-the-spire-2", "sts2-enemies-ai-brain", "spire-codex"],
  },
};

// ── Helpers ────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function run(cmd, args, opts = {}) {
  const joined = [cmd, ...args].join(" ");
  log(`$ ${joined}`);
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
    shell: true,
    timeout: 120000, // 2 min per call
  });
  if (result.stdout && result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr && result.stderr.trim()) process.stderr.write(result.stderr);
  return result;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ── Pipeline ───────────────────────────────────────────

function cleanSce(topic) {
  const path = join(root, "knowledge", topic, ".sce");
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    log(`  Cleaned .sce for ${topic}`);
  }
}

function indexTopic(topic) {
  const cli = join(root, "packages", "cli", "dist", "src", "main.js");
  const devVarsPath = join(root, "packages", "web", ".dev.vars");
  const raw = readFileSync(devVarsPath, "utf8").trim();
  const match = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*"(.+)"\s*$/m);
  const key = match ? match[1] : raw;

  const topicDir = join(root, "knowledge", topic);
  log(`  Indexing ${topic}...`);
  const result = run(process.execPath, [cli, "index", "."], {
    cwd: topicDir,
    env: { ...process.env, OPENROUTER_API_KEY: key },
  });
  if (result.status !== 0) {
    log(`  ⚠️  Index exited ${result.status}`);
    return false;
  }
  return true;
}

function exportTopic(topic) {
  const cli = join(root, "packages", "cli", "dist", "src", "main.js");
  const topicDir = join(root, "knowledge", topic);
  const exportDir = join(root, "knowledge", `${topic}-export`);

  // Clean old export
  if (existsSync(exportDir)) {
    rmSync(exportDir, { recursive: true, force: true });
  }
  mkdirSync(exportDir, { recursive: true });

  log(`  Exporting ${topic}...`);
  const result = run(process.execPath, [cli, "export", "-o", exportDir, "--path", topicDir], {
    cwd: root,
  });
  if (result.status !== 0) {
    log(`  ⚠️  Export exited ${result.status}`);
    return false;
  }
  return true;
}

function importTopic(topic) {
  const exportDir = join(root, "knowledge", `${topic}-export`);
  const webDir = join(root, "packages", "web");

  if (!existsSync(exportDir) || readdirSync(exportDir).filter(f => f.endsWith(".json")).length === 0) {
    log(`  No export files — skipping import`);
    return false;
  }

  log(`  Importing ${topic} to D1...`);

  // First import chunks + vectors
  const result = run("npx", ["tsx", "import.ts", exportDir, "sce-db", "--append"], {
    cwd: webDir,
    timeout: 300000, // 5 min for import
  });
  if (result.status !== 0) {
    log(`  ⚠️  Import exited ${result.status}, checking partial...`);
    // Check if at least some data made it in
    const chkResult = run("npx", [
      "wrangler", "d1", "execute", "sce-db", "--remote",
      "--command", `SELECT COUNT(*) as cnt FROM chunks WHERE repository_id LIKE '%${topic}%'`,
    ], { cwd: webDir, timeout: 15000 });
    return false;
  }
  return true;
}

// ── Main ───────────────────────────────────────────────

async function main() {
  const batchNums = Object.keys(batches).sort((a, b) => a - b);

  for (const batchNum of batchNums) {
    const batch = batches[batchNum];
    log(`\n${"═".repeat(60)}`);
    log(`BATCH ${batchNum}: ${batch.name}`);
    log(`${"═".repeat(60)}`);
    log(`Topics: ${batch.topics.join(", ")}`);

    // Phase 1: Clean + Index + Export (local, fast)
    log(`\n─── Phase 1: Index & Export ───`);
    for (const topic of batch.topics) {
      log(`\n  Topic: ${topic}`);
      cleanSce(topic);
      const ok = indexTopic(topic);
      if (ok) exportTopic(topic);
    }

    // Phase 2: Import to D1 (remote, slower)
    log(`\n─── Phase 2: Import to D1 ───`);
    for (const topic of batch.topics) {
      log(`\n  Importing: ${topic}`);
      importTopic(topic);
      // Small delay between imports to avoid D1 contention
      sleep(500);
    }
  }

  log(`\n${"═".repeat(60)}`);
  log(`ALL BATCHES COMPLETE`);
  log(`${"═".repeat(60)}`);

  // Summary: count chunks per topic
  log(`\nVerifying imports...`);
  for (const batchNum of Object.keys(batches).sort()) {
    for (const topic of batches[batchNum].topics) {
      const webDir = join(root, "packages", "web");
      const chkResult = run("npx", [
        "wrangler", "d1", "execute", "sce-db", "--remote",
        "--command", `SELECT COUNT(*) as cnt FROM chunks WHERE repository_id LIKE '%${topic}%'`,
      ], { cwd: webDir, timeout: 15000 });
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
