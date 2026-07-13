import type { IEmbeddingProvider, EmbeddingConfig } from "@sce/core";

export interface EmbeddingProviderConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
  batchSize: number;
  apiKeyEnv?: string;
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
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.config.model, input: batch })
    });

    if (!res.ok) {
      throw new Error(`Embedding provider request failed: HTTP ${res.status} from ${url}`);
    }

    let body: EmbeddingResponse;
    try {
      body = (await res.json()) as EmbeddingResponse;
    } catch {
      throw new Error(`Embedding provider returned malformed JSON from ${url}`);
    }

    if (!body || !Array.isArray(body.data) || body.data.length < batch.length) {
      throw new Error("Embedding provider response missing 'data' array of expected length");
    }

    return body.data.slice(0, batch.length).map((row, index) => {
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

export function createEmbeddingProvider(config: EmbeddingConfig): IEmbeddingProvider {
  return new OpenAICompatibleEmbeddingProvider({
    baseUrl: config.baseUrl,
    model: config.model,
    dimensions: config.dimensions,
    batchSize: config.batchSize,
    apiKeyEnv: config.apiKeyEnv
  });
}

function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/$/, "")}${suffix}`;
}