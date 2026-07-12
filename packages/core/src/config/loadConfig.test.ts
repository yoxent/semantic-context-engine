import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./loadConfig.js";

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
