import { mkdtemp, mkdir, cp, writeFile } from "node:fs/promises";
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

describe("createEngine hybrid wiring", () => {
  it("does not wire hybrid when embedding is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-hyb-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      await expect(created.engine.hybridSearch({ text: "SQLite" })).rejects.toThrow(/Hybrid search is not configured/);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("wires hybrid strategy when embedding block is present (routes without the not-configured error)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-hyb-"));
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
      // Hybrid is wired, so the call must not throw the not-configured error.
      // With no real embedding server, the semantic side will fail during the
      // embed call; we assert routing wires by matching the embedding failure
      // rather than the configuration error.
      await expect(created.engine.hybridSearch({ text: "vectors" })).rejects.toThrow(
        /Embedding provider|fetch|HTTP/
      );
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});

describe("createEngine code indexing", () => {
  it("indexes a repo with both .md and .ts files and returns code hits from keyword search", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-code-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      // Add a TS file to the vault copy.
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(
        join(dir, "src/widget.ts"),
        "export class Widget {\n  render(): string {\n    return 'widget';\n  }\n}\n"
      );
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({
          indexing: { include: ["**/*.md", "**/*.ts"] }
        })
      );

      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });

      // keyword search finds the class
      const kw = await created.engine.search({ text: "Widget", mode: "keyword", limit: 10 });
      expect(kw.hits.some((h) => h.path.endsWith("src/widget.ts") && h.headingPath?.[0] === "Widget")).toBe(true);

      // keyword search finds the method
      const method = await created.engine.search({ text: "render", mode: "keyword", limit: 10 });
      expect(method.hits.some((h) => h.path.endsWith("src/widget.ts") && h.headingPath?.[1] === "render")).toBe(true);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("still indexes Markdown-only repos unchanged when include stays default", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-code-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      const result = await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      expect(result.filesIndexed).toBe(3); // same 3 .md files as the existing runtime test
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});

describe("createEngine ast wiring", () => {
  it("always wires astStrategy (no config gate); astSearch on a code repo returns the symbol", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-ast-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await mkdir(join(dir, "src"), { recursive: true });
      await writeFile(
        join(dir, "src/widget.ts"),
        "export class Widget {\n  render(): string {\n    return 'widget';\n  }\n}\n"
      );
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({ indexing: { include: ["**/*.md", "**/*.ts"] } })
      );
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      const result = await created.engine.astSearch({ text: "Widget" });
      expect(result.hits.some((h) => h.path.endsWith("src/widget.ts") && h.symbolKind === "class" && h.headingPath?.[0] === "Widget")).toBe(true);
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });

  it("astSearch on a Markdown-only repo returns empty results (not an error)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-runtime-ast-"));
    let close: (() => void) | undefined;
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      const created = await createEngine(dir);
      close = created.close;
      await created.engine.indexRepository({ rootPath: created.rootPath, type: "vault" });
      const result = await created.engine.astSearch({ text: "anything" });
      expect(result.hits).toEqual([]);
      expect(result.diagnostics?.strategy).toBe("ast");
    } finally {
      close?.();
      await rmWithRetry(dir);
    }
  });
});
