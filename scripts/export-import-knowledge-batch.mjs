/**
 * Export + append-import knowledge topics to D1.
 * Usage: node scripts/export-import-knowledge-batch.mjs
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "packages", "cli", "dist", "src", "main.js");
const webDir = join(root, "packages", "web");

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

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(" ")}`);
  }
}

for (const topic of topics) {
  if (only.size && !only.has(topic)) continue;
  const topicDir = join(root, "knowledge", topic);
  if (!existsSync(join(topicDir, ".sce"))) {
    console.log(`SKIP ${topic} (no .sce)`);
    continue;
  }
  const exportDir = join(root, "knowledge", `${topic}-export`);
  mkdirSync(exportDir, { recursive: true });

  console.log(`\n==== EXPORT ${topic} ====`);
  run(process.execPath, [cli, "export", "-o", exportDir, "--path", topicDir], {
    cwd: root,
  });

  console.log(`==== IMPORT ${topic} ====`);
  run(
    "npx",
    ["tsx", "import.ts", exportDir, "sce-db", "--append"],
    { cwd: webDir, shell: true },
  );
}

console.log("\nEXPORT_IMPORT_DONE");
