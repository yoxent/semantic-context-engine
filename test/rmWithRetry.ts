import { rm } from "node:fs/promises";

function isRetriableRmError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY";
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const err = error as NodeJS.ErrnoException;
  return err.code ?? (err.cause && typeof err.cause === "object" ? (err.cause as NodeJS.ErrnoException).code : undefined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rmWithRetry(
  path: string,
  options: Parameters<typeof rm>[1] = { recursive: true, force: true },
  retries = 10,
  delayMs = 100
): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await rm(path, options);
      return;
    } catch (error) {
      if (!isRetriableRmError(error) || attempt === retries) throw error;
      await sleep(delayMs * (attempt + 1));
    }
  }
}
