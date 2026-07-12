#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { createEngine } from "@sce/runtime";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.name("sce");

  program
    .command("index")
    .argument("<path>")
    .option("--type <type>", "repository type", "vault")
    .action(async (path, options) => {
      const { engine, close, rootPath } = await createEngine(path);
      try {
        const result = await engine.indexRepository({ rootPath, type: options.type });
        console.log(`Indexed ${result.filesIndexed} files and ${result.chunksIndexed} chunks`);
      } finally {
        close();
      }
    });

  program
    .command("update")
    .argument("<path>")
    .action(async (path) => {
      const { engine, close, rootPath } = await createEngine(path);
      try {
        const result = await engine.updateRepository({ rootPath, type: "vault" });
        console.log(`Updated ${result.filesIndexed} files and ${result.chunksIndexed} chunks`);
      } finally {
        close();
      }
    });

  program
    .command("search")
    .argument("<query>")
    .requiredOption("--path <path>")
    .option("--limit <limit>", "maximum hit count")
    .option("--json", "print JSON")
    .action(async (query, options) => {
      const { engine, close, config } = await createEngine(options.path);
      try {
        const limit = options.limit !== undefined ? Number(options.limit) : config.search.defaultLimit;
        const result = await engine.search({ text: query, limit });
        const hits = result.hits.map((hit) => ({
          ...hit,
          snippet: truncate(hit.snippet, config.search.maxSnippetChars)
        }));

        if (options.json) {
          console.log(JSON.stringify({ ...result, hits }, null, 2));
        } else {
          for (const hit of hits) {
            console.log(`${hit.path}:${hit.startLine}-${hit.endLine} score=${hit.score}`);
            console.log(hit.snippet);
          }
        }
      } finally {
        close();
      }
    });

  program
    .command("chunk")
    .argument("<chunkId>")
    .requiredOption("--path <path>")
    .action(async (chunkId, options) => {
      const { engine, close } = await createEngine(options.path);
      try {
        const chunk = await engine.getChunk(chunkId);
        console.log(chunk.text);
      } finally {
        close();
      }
    });

  await program.parseAsync(argv, { from: "user" });
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function isExecutedAsMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (isExecutedAsMain()) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
