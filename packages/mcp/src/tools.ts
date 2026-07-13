import { createEngine } from "@sce/runtime";

export async function sceIndexRepository(input: { path: string; type?: "code" | "vault" }) {
  const { engine, close, rootPath } = await createEngine(input.path);
  try {
    return await engine.indexRepository({ rootPath, type: input.type ?? "vault" });
  } finally {
    close();
  }
}

export async function sceUpdateRepository(input: { path: string; type?: "code" | "vault" }) {
  const { engine, close, rootPath } = await createEngine(input.path);
  try {
    return await engine.updateRepository({ rootPath, type: input.type ?? "vault" });
  } finally {
    close();
  }
}

export async function sceSearch(input: {
  path: string;
  query: string;
  mode?: "keyword" | "semantic" | "hybrid";
  limit?: number;
  includeText?: boolean;
  pathFilter?: string;
  language?: string;
  repositoryIds?: string[];
}) {
  const { engine, close, config } = await createEngine(input.path);
  try {
    const result = await engine.search({
      text: input.query,
      mode: input.mode ?? "keyword",
      limit: input.limit ?? config.search.defaultLimit,
      pathFilter: input.pathFilter,
      language: input.language,
      repositoryIds: input.repositoryIds
    });
    const hits = await Promise.all(
      result.hits.map(async (hit) => {
        const snippet = truncate(hit.snippet, config.search.maxSnippetChars);
        if (!input.includeText) {
          return { ...hit, snippet };
        }
        const chunk = await engine.getChunk(hit.chunkId);
        return {
          ...hit,
          snippet,
          text: truncate(chunk.text, config.search.maxSnippetChars)
        };
      })
    );
    return { ...result, hits };
  } finally {
    close();
  }
}

export async function sceGetChunk(input: { path: string; chunkId: string; maxChars?: number }) {
  const { engine, close } = await createEngine(input.path);
  try {
    const chunk = await engine.getChunk(input.chunkId);
    if (input.maxChars === undefined) return chunk;
    return {
      ...chunk,
      text: truncate(chunk.text, input.maxChars)
    };
  } finally {
    close();
  }
}

export async function sceStats(input: { path: string }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.statistics();
  } finally {
    close();
  }
}

function truncate(text: string, maxChars: number): string {
  const limit = Math.max(0, maxChars);
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return `${text.slice(0, limit - 3)}...`;
}
