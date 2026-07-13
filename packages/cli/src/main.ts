#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { createEngine } from "@sce/runtime";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program.name("sce");
  program.exitOverride();
  program.option("--verbose", "emit structured debug logs to stderr");

  const verboseFrom = (command: Command): boolean => Boolean(command.optsWithGlobals().verbose);

  program
    .command("index")
    .argument("<path>")
    .option("--type <type>", "repository type", "vault")
    .action(async (path, options, command) => {
      const { engine, close, rootPath } = await createEngine(path, { verbose: verboseFrom(command) });
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
    .action(async (path, _options, command) => {
      const { engine, close, rootPath } = await createEngine(path, { verbose: verboseFrom(command) });
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
    .option("--path-filter <glob>", "restrict hits by path (exact, prefix, or GLOB)")
    .option("--language <language>", "restrict hits by language")
    .option("--mode <mode>", "search mode: keyword (default), semantic, hybrid, or ast", "keyword")
    .option("--symbol-kind <kind>", "restrict to a symbol kind (ast mode only)")
    .option("--json", "print JSON")
    .action(async (query, options, command) => {
      const { engine, close, config } = await createEngine(options.path, { verbose: verboseFrom(command) });
      try {
        const limit = options.limit !== undefined ? Number(options.limit) : config.search.defaultLimit;
        const mode: "keyword" | "semantic" | "hybrid" | "ast" =
          options.mode === "semantic" || options.mode === "hybrid" || options.mode === "ast" ? options.mode : "keyword";
        const result = await engine.search({
          text: query,
          mode,
          limit,
          pathFilter: options.pathFilter,
          language: options.language,
          ...(options.symbolKind ? { symbolKind: options.symbolKind } : {})
        });
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
    .action(async (chunkId, options, command) => {
      const { engine, close } = await createEngine(options.path, { verbose: verboseFrom(command) });
      try {
        const chunk = await engine.getChunk(chunkId);
        console.log(chunk.text);
      } finally {
        close();
      }
    });

  program
    .command("stats")
    .argument("<path>")
    .option("--json", "print JSON")
    .action(async (path, options, command) => {
      const { engine, close } = await createEngine(path, { verbose: verboseFrom(command) });
      try {
        const stats = await engine.statistics();
        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log(
            `repositories=${stats.repositoryCount} files=${stats.fileCount} chunks=${stats.chunkCount} links=${stats.linkCount}`
          );
          if (stats.lastIndexedAt) {
            console.log(`lastIndexedAt=${stats.lastIndexedAt}`);
          }
          for (const repo of stats.repositories) {
            console.log(
              `${repo.id} type=${repo.type} files=${repo.fileCount} chunks=${repo.chunkCount} indexedAt=${repo.indexedAt}`
            );
          }
        }
      } finally {
        close();
      }
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function truncate(text: string, maxChars: number): string {
  const limit = Math.max(0, maxChars);
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return `${text.slice(0, limit - 3)}...`;
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
