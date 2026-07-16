/**
 * Index + export + D1-append own project corpora.
 * Usage: node scripts/index-own-corpora.mjs
 */
import { readFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "packages", "cli", "dist", "src", "main.js");
const webDir = join(root, "packages", "web");
const logPath = join(root, "knowledge", "corpora-index.log");

const corpora = [
  {
    id: "corp-sce-packages",
    path: join(root, "packages"),
    exportDir: join(root, "knowledge", "corp-sce-packages-export"),
  },
  {
    id: "corp-word-guess",
    path: "E:\\Projects\\Indie\\word-guess",
    exportDir: join(root, "knowledge", "corp-word-guess-export"),
  },
  {
    id: "corp-web-portfolio",
    path: "E:\\Projects\\Web\\web-portfolio",
    exportDir: join(root, "knowledge", "corp-web-portfolio-export"),
  },
];

function loadKey() {
  const raw = readFileSync(join(root, "packages", "web", ".dev.vars"), "utf8").trim();
  const named = raw.match(/^\s*OPENROUTER_API_KEY\s*=\s*(.+)\s*$/im);
  if (named) return named[1].trim().replace(/^["']|["']$/g, "");
  if (/^sk-/.test(raw) || (!raw.includes("=") && !raw.includes("\n"))) return raw;
  throw new Error("Could not parse OPENROUTER_API_KEY from packages/web/.dev.vars");
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function log(msg) {
  console.log(msg);
  try {
    mkdirSync(join(root, "knowledge"), { recursive: true });
    appendFileSync(logPath, msg + "\n");
  } catch {
    /* ignore */
  }
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

const key = loadKey();
log(`KEY_LOADED len=${key.length}`);

const only = new Set(
  (process.env.SCE_ONLY_CORPORA || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

for (const corp of corpora) {
  if (only.size && !only.has(corp.id)) {
    log(`SKIP ${corp.id}`);
    continue;
  }
  if (!existsSync(join(corp.path, "sce.config.json"))) {
    log(`MISSING config: ${corp.path}/sce.config.json`);
    process.exit(1);
  }

  log(`\n==== INDEX ${corp.id} ====`);
  let ok = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    log(`attempt ${attempt}/5`);
    const status = run(process.execPath, [cli, "index", "."], {
      cwd: corp.path,
      env: { ...process.env, OPENROUTER_API_KEY: key },
    });
    if (status === 0) {
      ok = true;
      break;
    }
    sleep(attempt * 20000);
  }
  if (!ok) {
    log(`FAILED index ${corp.id}`);
    process.exit(1);
  }

  run(process.execPath, [cli, "stats", corp.path], { cwd: root });

  mkdirSync(corp.exportDir, { recursive: true });
  log(`==== EXPORT ${corp.id} ====`);
  if (
    run(process.execPath, [cli, "export", "-o", corp.exportDir, "--path", corp.path], {
      cwd: root,
    }) !== 0
  ) {
    process.exit(1);
  }

  log(`==== IMPORT ${corp.id} ====`);
  if (
    run("npx", ["tsx", "import.ts", corp.exportDir, "sce-db", "--append"], {
      cwd: webDir,
      shell: true,
    }) !== 0
  ) {
    process.exit(1);
  }
  sleep(3000);
}

log("OWN_CORPORA_DONE");
