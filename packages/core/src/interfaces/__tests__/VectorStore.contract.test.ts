import { describe, expect, it } from "vitest";
import type { IVectorStore } from "../VectorStore.js";

describe("IVectorStore contract", () => {
  it("supports repository/model/dimensions metadata on upsert and search", () => {
    const store: IVectorStore = {
      upsert: async () => undefined,
      search: async () => [],
      deleteByChunk: async () => undefined,
      deleteByRepository: async () => undefined,
      deleteByFile: async () => undefined,
      getModelDimensions: async () => undefined
    };
    expect(typeof store.upsert).toBe("function");
    expect(typeof store.search).toBe("function");
    expect(typeof store.deleteByChunk).toBe("function");
    expect(typeof store.getModelDimensions).toBe("function");
  });
});
