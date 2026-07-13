import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./loadConfig.js";
import { sceConfigSchema } from "./schema.js";

describe("loadConfig", () => {
  it("uses defaults when sce.config.json is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-config-"));
    try {
      const config = await loadConfig(dir);
      expect(config.indexing.include).toEqual(["**/*.md"]);
      expect(config.search.defaultLimit).toBe(10);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("merges user config with defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-config-"));
    try {
      await writeFile(
        join(dir, "sce.config.json"),
        JSON.stringify({ search: { defaultLimit: 3 }, logging: { level: "debug" } })
      );
      const config = await loadConfig(dir);
      expect(config.indexing.ignore).toContain(".git/**");
      expect(config.search.defaultLimit).toBe(3);
      expect(config.logging.level).toBe("debug");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("embedding config", () => {
  it("parses a valid embedding block with defaults", () => {
    const parsed = sceConfigSchema.parse({
      embedding: {
        provider: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        model: "nomic-embed-text",
        dimensions: 768
      }
    });
    expect(parsed.embedding).toEqual({
      provider: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      dimensions: 768,
      batchSize: 32,
      apiKeyEnv: undefined
    });
  });

  it("applies batchSize default and accepts apiKeyEnv", () => {
    const parsed = sceConfigSchema.parse({
      embedding: {
        provider: "openai-compatible",
        baseUrl: "http://localhost:11434/v1",
        model: "nomic-embed-text",
        dimensions: 768,
        apiKeyEnv: "OPENAI_API_KEY"
      }
    });
    expect(parsed.embedding?.batchSize).toBe(32);
    expect(parsed.embedding?.apiKeyEnv).toBe("OPENAI_API_KEY");
  });

  it("rejects unknown provider values", () => {
    expect(() =>
      sceConfigSchema.parse({
        embedding: { provider: "vertex", baseUrl: "x", model: "m", dimensions: 768 }
      })
    ).toThrow();
  });

  it("requires dimensions, baseUrl, and model when embedding block present", () => {
    expect(() =>
      sceConfigSchema.parse({ embedding: { provider: "openai-compatible" } })
    ).toThrow();
  });

  it("treats embedding as optional absent", () => {
    expect(sceConfigSchema.parse({}).embedding).toBeUndefined();
  });
});
