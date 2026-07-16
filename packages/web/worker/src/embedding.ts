/**
 * OpenRouter embedding client.
 * Calls the OpenRouter API at query time to embed search queries.
 */

const EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2:free";

export interface EmbeddingEnv {
  OPENROUTER_API_KEY: string;
}

/**
 * Embed a single query string via OpenRouter.
 * Returns a float array (2048 dimensions for the default model).
 */
export async function embedQuery(
  env: EmbeddingEnv,
  query: string
): Promise<number[]> {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: query,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Embedding request failed: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as {
    data: { embedding: number[] }[];
  };

  if (!data.data || data.data.length === 0 || !data.data[0].embedding) {
    throw new Error("Embedding response missing embedding data");
  }

  return data.data[0].embedding;
}
