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

  it("throws a clear error on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse({ error: "boom" }, 503));
    const provider = new OpenAICompatibleEmbeddingProvider(baseConfig);
    await expect(provider.embed(["x"])).rejects.toThrow(/503/);
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