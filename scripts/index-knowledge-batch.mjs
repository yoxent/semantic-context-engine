/**
 * Index knowledge topics using OPENROUTER_API_KEY from packages/web/.dev.vars
 * Usage: node scripts/index-knowledge-batch.mjs
 * Never prints the API key.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const devVarsPath = join(root, "packages", "web", ".dev.vars");

function loadKey() {
  const raw = readFileSync(devVarsPath, "utf8").trim();
  const named = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)\s*$/im);
  if (named) return named[1].trim().replace(/^["']|["']$/g, "");
  if (/^sk-/.test(raw)) return raw;
  // single-line bare value with no KEY= prefix
  if (raw && !raw.includes("\n") && !raw.includes("=")) return raw;
  throw new Error(
    `Could not parse OPENROUTER_API_KEY from ${devVarsPath}. Use OPENROUTER_API_KEY=... or a bare sk- key.`,
  );
}

const topics = [
  "expo",
  "firebase",
  "google-cloud-thin",
  "react-native",
  "kotlin",
  "monetization-iap",
  "play-console",
  "apple-gamecenter-iap",
  "rn-tooling",
  "tailwind-css",
  "resend",
  "vercel",
  "t3-env",
  "zod",
  "drizzle-neon",
  "fastapi-python",
  "docker-ngrok",
  "wrangler",
  "openrouter",
  "mcp",
  "sqlite",
];

const only = new Set(
  (process.env.SCE_ONLY_TOPICS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const skip = new Set(
  (process.env.SCE_SKIP_TOPICS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const key = loadKey();
console.log(`KEY_LOADED len=${key.length}`);

const cli = join(root, "packages", "cli", "dist", "src", "main.js");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function indexTopic(topic, dir) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`==== INDEX ${topic} (attempt ${attempt}/${maxAttempts}) ====`);
    const result = spawnSync(process.execPath, [cli, "index", "."], {
      cwd: dir,
      env: { ...process.env, OPENROUTER_API_KEY: key },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status === 0) return true;
    const errText = `${result.stdout || ""}\n${result.stderr || ""}`;
    const retryable =
      /missing 'data'|HTTP 429|rate limit|temporarily|timeout/i.test(errText);
    if (!retryable || attempt === maxAttempts) {
      console.error(`FAILED ${topic} exit=${result.status}`);
      return false;
    }
    const waitMs = attempt * 15000;
    console.log(`retrying ${topic} in ${waitMs}ms...`);
    sleep(waitMs);
  }
  return false;
}

for (const topic of topics) {
  if (only.size && !only.has(topic)) {
    console.log(`SKIP ${topic} (SCE_ONLY_TOPICS)`);
    continue;
  }
  if (skip.has(topic)) {
    console.log(`SKIP ${topic} (SCE_SKIP_TOPICS)`);
    continue;
  }
  const dir = join(root, "knowledge", topic);
  const cfg = join(dir, "sce.config.json");
  if (!existsSync(cfg)) {
    console.log(`SKIP ${topic} (no sce.config.json)`);
    continue;
  }
  // Prefer batchSize 1 for free embedding models
  try {
    const cfgObj = JSON.parse(readFileSync(cfg, "utf8"));
    if (cfgObj.embedding) {
      cfgObj.embedding.batchSize = 1;
      writeFileSync(cfg, JSON.stringify(cfgObj, null, 2) + "\n");
    }
  } catch {
    // ignore config rewrite failures
  }
  const mdCount = readdirSync(dir).filter((f) => f.endsWith(".md")).length;
  console.log(`topic=${topic} md=${mdCount}`);
  if (!indexTopic(topic, dir)) process.exit(1);
  console.log(`OK ${topic}`);
  sleep(3000);
}

console.log("INDEX_PHASE_DONE");
