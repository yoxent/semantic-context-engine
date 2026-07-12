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

export async function sceSearch(input: { path: string; query: string; limit?: number; includeText?: boolean }) {
  const { engine, close, config } = await createEngine(input.path);
  try {
    const result = await engine.search({
      text: input.query,
      limit: input.limit ?? config.search.defaultLimit
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

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}
