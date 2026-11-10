/**
 * Rebuild one local index. Loads OPENROUTER_API_KEY from packages/web/.dev.vars
 * and passes it to the CLI. Does not print the key. Does not export or import.
 *
 * D1's embedding_config is global — use this script during the model migration,
 * not scripts/index-own-corpora.mjs. See docs/RESUME-embedding-migration.md.
 *
 * Usage (from the repo root):
 *   node scripts/reindex-one.mjs <absolute-corpus-root>
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/reindex-one.mjs <absolute-corpus-root>");
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
console.log(`INDEX ${target}`);
const result = spawnSync(process.execPath, [cli, "index", "."], {
  cwd: target,
  env: { ...process.env, OPENROUTER_API_KEY: key },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
