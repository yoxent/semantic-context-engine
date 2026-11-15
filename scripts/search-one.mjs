/**
 * Run one CLI search with OPENROUTER_API_KEY loaded from packages/web/.dev.vars.
 * Does not print the key. Semantic and hybrid each spend one embedding request.
 *
 * Usage (from the repo root):
 *   node scripts/search-one.mjs "<query>" --path <absolute-corpus-root> --mode keyword --limit 2
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/search-one.mjs <query> --path <absolute-corpus-root> [--mode keyword] [--limit 2]");
  process.exit(1);
}

const raw = readFileSync(join(root, "packages", "web", ".dev.vars"), "utf8").trim();
const named = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)\s*$/im);
const key = named ? named[1].trim().replace(/^["']|["']$/g, "") : raw;
if (!key || key.includes("\n") || key.includes("=")) {
  console.error("Could not parse OPENROUTER_API_KEY from packages/web/.dev.vars");
  process.exit(1);
}
console.log(`KEY_LOADED len=${key.length}`);

const cli = join(root, "packages", "cli", "dist", "src", "main.js");
const result = spawnSync(process.execPath, [cli, "search", ...args], {
  cwd: root,
  env: { ...process.env, OPENROUTER_API_KEY: key },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
