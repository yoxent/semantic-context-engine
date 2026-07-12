import { mkdtemp, cp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rmWithRetry } from "../../../../test/rmWithRetry.js";
import { run } from "../main.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("CLI run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("indexes a vault and prints a summary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-cli-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await run(["index", dir, "--type", "vault"]);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/Indexed 3 files and \d+ chunks/));
    } finally {
      await rmWithRetry(dir);
    }
  });
});
