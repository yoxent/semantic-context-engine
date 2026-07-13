import { mkdtemp, cp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createLogger } from "@sce/core";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { createEngine } from "../createEngine.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("createEngine", () => {
  it("loads sce.config.json and resolves root paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          indexing: { include: ["Architecture.md"] },
          search: { defaultLimit: 2, maxSnippetChars: 40 }
        })
      );

      const created = await createEngine(dir);
      close = created.close;
      expect(created.rootPath).toBe(resolve(dir));
      expect(created.config.search.defaultLimit).toBe(2);
      expect(created.config.indexing.include).toEqual(["Architecture.md"]);

      const indexed = await created.engine.indexRepository({
        rootPath: created.rootPath,
        type: "vault"
      });
      expect(indexed.filesIndexed).toBe(1);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("honors logging.level and verbose override", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(join(dir, "sce.config.json"), JSON.stringify({ logging: { level: "warn" } }));

      const quiet = await createEngine(dir);
      close = quiet.close;
      expect(quiet.logger.level).toBe("warn");
      close();

      const verbose = await createEngine(dir, { verbose: true });
      close = verbose.close;
      expect(verbose.logger.level).toBe("debug");

      const lines: string[] = [];
      close();
      const observed = await createEngine(dir, {
        verbose: true,
        logger: createLogger({ level: "debug", sink: (line) => lines.push(line) })
      });
      close = observed.close;
      await observed.engine.indexRepository({ rootPath: observed.rootPath, type: "vault" });
      expect(lines.some((line) => JSON.parse(line).message === "indexRepository.done")).toBe(true);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});

describe("createEngine semantic wiring", () => {
  it("builds a keyword-only engine when embedding is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-sem-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      // keyword search still works
      const result = await created.engine.search({ text: "SQLite", limit: 3 });
      expect(result.hits.length).toBeGreaterThan(0);
      // semantic is not configured
      await expect(created.engine.semanticSearch({ text: "SQLite" })).rejects.toThrow(/Semantic search is not configured/);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("wires semantic strategy when embedding block is present (using a stubbed provider via env)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-sem-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          embedding: {
            provider: "openai-compatible",
            baseUrl: "http://localhost:11434/v1",
            model: "nomic-embed-text",
            dimensions: 4
          }
        })
      );
      const created = await createEngine(dir);
      close = created.close;
      // Asking for semantic routes to the strategy; with no real server, search call
      // will embed by hitting the server. We only assert routing wires (engine accepts
      // semantic mode without the "not configured" error) by catching the fetch failure.
      await expect(created.engine.semanticSearch({ text: "vectors" })).rejects.toThrow(/Embedding provider|fetch|HTTP/);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});
