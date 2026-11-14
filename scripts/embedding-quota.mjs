/**
 * Print the OpenRouter free-model daily request counter.
 * Does not call the embeddings API and does not print the key.
 *
 * Usage (from the repo root):
 *   node scripts/embedding-quota.mjs
 *
 * Exit 0 when requests remain, exit 2 when remaining is 0.
 */
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const raw = readFileSync(join(root, "packages", "web", ".dev.vars"), "utf8").trim();
const named = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)\s*$/im);
const key = named ? named[1].trim().replace(/^["']|["']$/g, "") : raw;
if (!key || key.includes("\n") || key.includes("=")) {
  console.error("Could not parse OPENROUTER_API_KEY from packages/web/.dev.vars");
  process.exit(1);
}

const res = await fetch("https://openrouter.ai/api/v1/key", {
  headers: { Authorization: `Bearer ${key}` },
});
const json = await res.json();
const quota = json?.data?.free_model_daily_requests ?? null;
console.log(JSON.stringify({ status: res.status, free_model_daily_requests: quota }));
if (!res.ok || !quota || typeof quota.remaining !== "number") {
  process.exitCode = 1;
} else if (quota.remaining <= 0) {
  process.exitCode = 2;
}
