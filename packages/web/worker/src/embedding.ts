/**
 * OpenRouter embedding client.
 * Calls the OpenRouter API at query time to embed search queries.
 */

const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b:free";

/**
 * Model + dimension the vectors in D1 were built with.
 *
 * Query-time embeddings MUST come from the same model that produced the stored
 * vectors. Vectors are compared by cosine similarity, which only checks array
 * length — a mismatch would silently return meaningless scores instead of
 * failing, so the caller compares this against `embedding_config`.
 */
export const VECTOR_MODEL = EMBEDDING_MODEL;
export const VECTOR_DIMENSIONS = 2048;

export interface EmbeddingEnv {
  OPENROUTER_API_KEY: string;
}

/**
 * Embed a single query string via OpenRouter.
 * Returns a 2048-dim float array (VECTOR_DIMENSIONS).
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
