import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { scoreVectorsForIds } from "./vectorScan";

interface StoredVector {
  chunk_id: string;
  embedding: number[];
}

function vec(...values: number[]): number[] {
  return values;
}

function createMockDb(
  vectors: StoredVector[],
  options: { throwIfBatchGreaterThan?: number } = {}
): D1Database {
  const byId = new Map(vectors.map((row) => [row.chunk_id, row]));
  const maxBatch = options.throwIfBatchGreaterThan;

  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              if (!/chunk_id IN/i.test(sql)) {
                throw new Error("D1_ERROR: Memory limit exceeded before EOF.");
              }
              if (maxBatch !== undefined && params.length > maxBatch) {
                throw new Error("D1_ERROR: Memory limit exceeded before EOF.");
              }
              const rows = params
                .map((id) => byId.get(String(id)))
                .filter((row): row is StoredVector => row !== undefined)
                .map((row) => ({
                  chunk_id: row.chunk_id,
                  embedding: JSON.stringify(row.embedding),
                }));
              return { results: rows };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("scoreVectorsForIds", () => {
  it("returns no scores for an empty candidate list", async () => {
    const db = createMockDb([{ chunk_id: "a", embedding: vec(1, 0) }]);
    await expect(scoreVectorsForIds(db, vec(1, 0), [])).resolves.toEqual([]);
  });

  it("scores only the requested ids and ranks the closest first", async () => {
    const db = createMockDb([
      { chunk_id: "c1", embedding: vec(1, 0, 0) },
      { chunk_id: "c2", embedding: vec(0, 1, 0) },
      { chunk_id: "c3", embedding: vec(0, 0, 1) },
    ]);

    const scores = await scoreVectorsForIds(db, vec(0, 0, 1), ["c1", "c3"], 8);
    scores.sort((a, b) => b.score - a.score);

    expect(scores.map((s) => s.chunkId)).toEqual(["c3", "c1"]);
    expect(scores[0]?.score).toBeCloseTo(1, 5);
  });

  it("retries with a smaller IN batch after a D1 memory-limit error", async () => {
    const db = createMockDb(
      [
        { chunk_id: "v1", embedding: vec(1, 0) },
        { chunk_id: "v2", embedding: vec(0, 1) },
        { chunk_id: "v3", embedding: vec(1, 1) },
      ],
      { throwIfBatchGreaterThan: 2 }
    );

    const scores = await scoreVectorsForIds(
      db,
      vec(0, 1),
      ["v1", "v2", "v3"],
      8
    );
    scores.sort((a, b) => b.score - a.score);

    expect(scores).toHaveLength(3);
    expect(scores[0]?.chunkId).toBe("v2");
  });
});
