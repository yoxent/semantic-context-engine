import { mkdtemp, cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { createEngine } from "../createEngine.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

async function startStubEmbeddingServer(dimensions: number): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      let parsed: { input?: string[] } = {};
      try { parsed = JSON.parse(body); } catch {}
      const n = parsed.input?.length ?? 1;
      const data = Array.from({ length: n }, () => ({ embedding: Array.from({ length: dimensions }, () => 0.01) }));
      res.end(JSON.stringify({ data }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { baseUrl: `http://127.0.0.1:${port}/v1`, close: () => new Promise((r) => server.close(() => r())) };
}

describe("sem search end-to-end", () => {
  it("indexes and searches semantically through runtime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-sem-e2e-"));
    let close: (() => void) | undefined;
    const server = await startStubEmbeddingServer(8);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          embedding: {
            provider: "openai-compatible",
            baseUrl: server.baseUrl,
            model: "stub-embed",
            dimensions: 8
          }
        })
      );

      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });

      const result = await created.engine.semanticSearch({ text: "vector retrieval", limit: 10 });
      expect(result.diagnostics?.strategy).toBe("semantic");
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits.every((hit) => hit.strategy === "semantic")).toBe(true);
      for (const hit of result.hits) {
        expect(hit.path.length).toBeGreaterThan(0);
        expect(hit.chunkId.length).toBeGreaterThan(0);
      }
    } finally {
      close?.();
      await server.close();
      await rmWithRetry(dir);
    }
  });
});
