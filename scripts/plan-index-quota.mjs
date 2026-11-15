/**
 * Zero-quota cost of a full rebuild: discover + chunk current files, then
 * count embedding requests as sum(ceil(fileChunks / batchSize)).
 * Does not open the embedding API and does not write the index.
 *
 * Usage (from the repo root):
 *   node scripts/plan-index-quota.mjs <corpus-root> [more roots...]
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { detectLanguage, loadConfig } from "@sce/core";
import { discoverFiles } from "@sce/indexing";
import { LanguageChunkerRegistry, MarkdownChunker, TreeSitterCodeChunker } from "@sce/parsing";

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("usage: node scripts/plan-index-quota.mjs <corpus-root> [more roots...]");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const MAX_CHARS = 7500;
const BATCHES = [1, 5, 10, 20, 40];

function splitLengths(text) {
  if (text.length <= MAX_CHARS) return [text.length];
  const lengths = [];
  const total = Math.ceil(text.length / MAX_CHARS);
  let offset = 0;
  let part = 0;
  while (offset < text.length) {
    const end = Math.min(text.length, offset + MAX_CHARS);
    const suffix = end === text.length
      ? `\n\n---\n📄 *Part ${part + 1} of ${total} (end)*`
      : `\n\n---\n→ *Continues in Part ${part + 2} of ${total}*`;
    lengths.push((end - offset) + suffix.length);
    part++;
    offset = end;
  }
  return lengths;
}

function requestsFor(counts, batchSize) {
  return counts.reduce((sum, n) => sum + (n === 0 ? 0 : Math.ceil(n / batchSize)), 0);
}

function maxBatchChars(perFileLengths, batchSize) {
  let max = 0;
  let maxFile = "";
  for (const file of perFileLengths) {
    for (let i = 0; i < file.lengths.length; i += batchSize) {
      const chars = file.lengths.slice(i, i + batchSize).reduce((a, b) => a + b, 0);
      if (chars > max) {
        max = chars;
        maxFile = file.path;
      }
    }
  }
  return { max, maxFile };
}

function dbState(root) {
  const dbPath = join(root, ".sce", "metadata.sqlite");
  if (!existsSync(dbPath)) return { dbPath, missing: true };
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const one = (sql) => db.prepare(sql).get();
  const models = db.prepare("select model, dimensions, count(*) as n from vectors group by model, dimensions").all();
  const chunks = one("select count(*) as n from chunks").n;
  const vectors = one("select count(*) as n from vectors").n;
  const files = one("select count(*) as n from files").n;
  db.close();
  return { dbPath, files, chunks, vectors, models };
}

const markdown = new MarkdownChunker();
const typescript = await TreeSitterCodeChunker.create("typescript");
const javascript = await TreeSitterCodeChunker.create("javascript");
const chunker = new LanguageChunkerRegistry({
  chunkers: { markdown, typescript, javascript },
});

for (const root of roots) {
  const config = await loadConfig(root);
  const files = await discoverFiles({
    rootPath: root,
    include: config.indexing.include,
    ignore: config.indexing.ignore,
  });
  const perFile = [];
  let unsupported = 0;
  for (const relativePath of files) {
    const language = detectLanguage(relativePath);
    if (language === "text") {
      unsupported++;
      continue;
    }
    const text = await readFile(join(root, relativePath), "utf8");
    const fileHash = createHash("sha256").update(text).digest("hex");
    const raw = chunker.chunk({ repositoryId: "dry", relativePath, language, fileHash, text });
    const lengths = raw.flatMap((chunk) => splitLengths(chunk.text));
    perFile.push({ path: relativePath, chunks: lengths.length, lengths });
  }
  const counts = perFile.map((f) => f.chunks);
  const totalChunks = counts.reduce((a, b) => a + b, 0);
  const multi = perFile.filter((f) => f.chunks > 1).sort((a, b) => b.chunks - a.chunks).slice(0, 8);
  console.log("\n==== " + root);
  console.log("config model", config.embedding?.model, "batchSize", config.embedding?.batchSize);
  console.log("db", JSON.stringify(dbState(root)));
  console.log("discovered", files.length, "chunkedFiles", perFile.length, "unsupported", unsupported, "chunks", totalChunks);
  console.log("largest files", multi.map((f) => `${f.chunks} ${f.path}`).join(" | ") || "(all files are 1 chunk)");
  for (const batchSize of BATCHES) {
    const { max, maxFile } = maxBatchChars(perFile, batchSize);
    console.log(
      `batch ${String(batchSize).padStart(2)}  requests ${String(requestsFor(counts, batchSize)).padStart(4)}  maxBatchChars ${max} (~${Math.ceil(max / 4)} tok)  ${maxFile}`,
    );
  }
}
