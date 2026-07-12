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

  it("prints stats after indexing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-cli-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await run(["index", dir, "--type", "vault"]);
      log.mockClear();
      await run(["stats", dir]);
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/repositories=1 files=3 chunks=\d+ links=\d+/));
    } finally {
      await rmWithRetry(dir);
    }
  });

  it("emits structured stderr logs when --verbose is set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sce-cli-"));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await cp(join(repoRoot, "fixtures/sample-vault"), dir, { recursive: true });
      await run(["--verbose", "index", dir, "--type", "vault"]);
      expect(log).toHaveBeenCalled();
      const payloads = write.mock.calls
        .map((call) => String(call[0]))
        .filter((line) => line.trim().startsWith("{"))
        .map((line) => JSON.parse(line.trim()));
      expect(payloads.some((entry) => entry.message === "indexRepository.done")).toBe(true);
    } finally {
      await rmWithRetry(dir);
    }
  });
});
