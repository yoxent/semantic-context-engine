import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, defaultIgnorePatterns } from "./defaults.js";
import { sceConfigSchema, type SceConfig } from "./schema.js";

export async function loadConfig(rootPath: string): Promise<SceConfig> {
  const configPath = join(rootPath, "sce.config.json");
  let raw: unknown = {};

  try {
    raw = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Failed to read ${configPath}: ${(error as Error).message}`);
    }
  }

  const parsed = sceConfigSchema.parse(raw);
  return {
    repositories: parsed.repositories,
    indexing: {
      include: parsed.indexing.include,
      ignore: [...new Set([...defaultIgnorePatterns, ...parsed.indexing.ignore])]
    },
    search: {
      defaultLimit: parsed.search.defaultLimit ?? defaultConfig.search.defaultLimit,
      maxSnippetChars: parsed.search.maxSnippetChars ?? defaultConfig.search.maxSnippetChars
    },
    logging: {
      level: parsed.logging.level ?? defaultConfig.logging.level
    },
    embedding: parsed.embedding
  };
}
