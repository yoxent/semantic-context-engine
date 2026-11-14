import { describe, expect, it, vi, afterEach } from "vitest";
import { OpenAICompatibleEmbeddingProvider } from "../OpenAICompatibleEmbeddingProvider.js";

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TEST_KEY;
});

const baseConfig = {
  baseUrl: "http://localhost:11434/v1",
  model: "nomic-embed-text",
  dimensions: 3,
  batchSize: 2
};

describe("OpenAICompatibleEmbeddingProvider", () => {
  it("POSTs a single batch and returns vectors in order", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }] }));

    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    const result = await provider.embed(["alpha", "beta"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:11434/v1/embeddings");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload).toEqual({ model: "nomic-embed-text", input: ["alpha", "beta"] });
    expect(result).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6]
    ]);
  });

  it("splits texts into batchSize batches and concatenates results in order", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, _init) =>
      mockResponse({ data: [{ embedding: [1, 1, 1] }, { embedding: [2, 2, 2] }] })
    );

    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    const result = await provider.embed(["a", "b", "c", "d", "e"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(5);
    expect(result.map((v) => v[0])).toEqual([1, 2, 1, 2, 1]);
  });

  it("rejects invalid batch sizes before sending a provider request", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ data: [{ embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, batchSize: 0 });

    await expect(provider.embed(["x"])).rejects.toThrow(/batchSize/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ error: "boom" }, 503));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, maxRetries: 0 });
    await expect(provider.embed(["x"])).rejects.toThrow(/503/);
  });

  it("does not retry a client error such as 400", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ error: "bad" }, 400));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, retryDelayMs: 0 });
    await expect(provider.embed(["x"])).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(mockResponse({ data: [{ embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, retryDelayMs: 0 });
    const result = await provider.embed(["x"]);
    expect(result).toEqual([[1, 2, 3]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 500 and gives up after maxRetries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ error: "boom" }, 500));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, maxRetries: 2, retryDelayMs: 0 });
    await expect(provider.embed(["x"])).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("honours a Retry-After header in seconds when retrying", async () => {
    const headers = new Map([["retry-after", "2"]]);
    const limited = {
      ...mockResponse({ error: "rate limited" }, 429),
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null }
    } as unknown as Response;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce(mockResponse({ data: [{ embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, retryDelayMs: 0 });
    await provider.embed(["x"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on malformed response payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ data: [{ not_embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    await expect(provider.embed(["x"])).rejects.toThrow(/embedding/i);
  });

  it("rejects when the returned vector dimensions do not match config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ data: [{ embedding: [1, 2] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig); // dimensions = 3
    await expect(provider.embed(["x"])).rejects.toThrow(/dimension/i);
  });

  it("sends a bearer token from the apiKeyEnv environment variable when set", async () => {
    process.env.TEST_KEY = "secret-token";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ data: [{ embedding: [1, 2, 3] }] }));
    const provider = new OpenAICompatibleEmbeddingProvider({ ...baseConfig, apiKeyEnv: "TEST_KEY" });
    await provider.embed(["x"]);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });
});
