import { createEngine } from "./createEngine.js";

export async function sceIndexRepository(input: { path: string; type?: "code" | "vault" }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.indexRepository({ rootPath: input.path, type: input.type ?? "vault" });
  } finally {
    close();
  }
}

export async function sceUpdateRepository(input: { path: string; type?: "code" | "vault" }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.updateRepository({ rootPath: input.path, type: input.type ?? "vault" });
  } finally {
    close();
  }
}

export async function sceSearch(input: { path: string; query: string; limit?: number; includeText?: boolean }) {
  const { engine, close } = await createEngine(input.path);
  try {
    const result = await engine.search({ text: input.query, limit: input.limit ?? 10 });
    if (!input.includeText) return result;
    const hits = await Promise.all(
      result.hits.map(async (hit) => ({ ...hit, text: (await engine.getChunk(hit.chunkId)).text }))
    );
    return { ...result, hits };
  } finally {
    close();
  }
}

export async function sceGetChunk(input: { path: string; chunkId: string }) {
  const { engine, close } = await createEngine(input.path);
  try {
    return await engine.getChunk(input.chunkId);
  } finally {
    close();
  }
}
