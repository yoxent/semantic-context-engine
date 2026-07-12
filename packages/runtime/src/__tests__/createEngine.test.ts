import { mkdtemp, cp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
});
