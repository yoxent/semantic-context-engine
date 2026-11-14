import type { IEmbeddingProvider, EmbeddingConfig } from "@sce/core";

export interface EmbeddingProviderConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  batchSize: number;
  apiKeyEnv?: string;
  /** Extra attempts after a retryable failure (429/5xx/network). Default 3. */
  maxRetries?: number;
  /** Base delay for exponential backoff, in ms. Default 1000. */
  retryDelayMs?: number;
  /** Cap for a single backoff delay, in ms. Default 30000. */
  maxRetryDelayMs?: number;
}

interface EmbeddingResponseRow {
  embedding?: unknown;
}

interface EmbeddingResponse {
  data?: EmbeddingResponseRow[];
}

export class OpenAICompatibleEmbeddingProvider implements IEmbeddingProvider {
  constructor(private readonly config: EmbeddingProviderConfig) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!Number.isInteger(this.config.batchSize) || this.config.batchSize <= 0) {
      throw new Error(`Embedding provider batchSize must be a positive integer, got ${this.config.batchSize}`);
    }
    if (texts.length === 0) return [];
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const vectors = await this.embedBatch(batch);
      out.push(...vectors);
    }
    return out;
  }

  private async embedBatch(batch: string[]): Promise<number[][]> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKeyEnv) {
      const token = process.env[this.config.apiKeyEnv];
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const url = joinUrl(this.config.baseUrl, "/embeddings");
    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.retryDelayMs ?? 1000;
    const maxDelay = this.config.maxRetryDelayMs ?? 30000;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ model: this.config.model, input: batch })
        });
      } catch (error) {
        // Network-level failure: retry with backoff, then surface the original error.
        if (attempt >= maxRetries) throw error;
        await sleep(backoffDelay(attempt, baseDelay, maxDelay));
        continue;
      }

      if (!res.ok) {
        // Retry only on transient conditions: rate limiting and server errors.
        // A 400/401/404 will never succeed on retry, so fail fast.
        if (!isRetryableStatus(res.status) || attempt >= maxRetries) {
          throw new Error(`Embedding provider request failed: HTTP ${res.status} from ${url}`);
        }
        await sleep(retryAfterDelay(res, backoffDelay(attempt, baseDelay, maxDelay)));
        continue;
      }

      return this.parseResponse(res, batch.length, url);
    }
  }

  private async parseResponse(res: Response, expected: number, url: string): Promise<number[][]> {
    let body: EmbeddingResponse;
    try {
      body = (await res.json()) as EmbeddingResponse;
    } catch {
      throw new Error(`Embedding provider returned malformed JSON from ${url}`);
    }

    if (!body || !Array.isArray(body.data) || body.data.length < expected) {
      throw new Error("Embedding provider response missing 'data' array of expected length");
    }

    return body.data.slice(0, expected).map((row, index) => {
      const vector = row?.embedding;
      if (!Array.isArray(vector) || vector.some((v) => typeof v !== "number")) {
        throw new Error(`Embedding provider response entry ${index} is missing a numeric embedding array`);
      }
      if (vector.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${vector.length} (entry ${index})`
        );
      }
      return vector as number[];
    });
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

/** Exponential backoff: base, 2x, 4x ... capped at maxDelay. */
function backoffDelay(attempt: number, base: number, max: number): number {
  return Math.min(max, base * 2 ** attempt);
}

/**
 * Prefer the server's Retry-After hint so we resume exactly when allowed instead
 * of burning the remaining attempts while still rate limited.
 */
function retryAfterDelay(res: Response, fallback: number): number {
  const raw = res.headers?.get?.("retry-after");
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return fallback;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export function createEmbeddingProvider(config: EmbeddingConfig): IEmbeddingProvider {
  return new OpenAICompatibleEmbeddingProvider({
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
    batchSize: config.batchSize,
    apiKeyEnv: config.apiKeyEnv,
    ...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
    ...(config.retryDelayMs !== undefined ? { retryDelayMs: config.retryDelayMs } : {})
  });
}

function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/$/, "")}${suffix}`;
}
