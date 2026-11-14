import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { fetchCandidateChunkIds } from "./candidates";

interface ChunkRow {
  id: string;
  text: string;
  relative_path: string;
  heading_path: string;
}

function createChunkDb(chunks: ChunkRow[]): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              const limit = Number(params[params.length - 1]);
              const patterns = params.slice(0, -1).filter((_, i) => i % 3 === 0) as string[];
              const needles = patterns.map((p) =>
                String(p).replace(/^%/, "").replace(/%$/, "")
              );
              const joiner = /\) AND \(/i.test(sql) ? "AND" : "OR";

              const matched = chunks.filter((chunk) => {
                const hay = `${chunk.text} ${chunk.relative_path} ${chunk.heading_path}`.toLowerCase();
                return joiner === "AND"
                  ? needles.every((n) => hay.includes(n))
                  : needles.some((n) => hay.includes(n));
              });

              return {
                results: matched.slice(0, limit).map((c) => ({ id: c.id })),
              };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("fetchCandidateChunkIds", () => {
  const chunks: ChunkRow[] = [
    {
      id: "and-both",
      text: "boids steering",
      relative_path: "boids.md",
      heading_path: "Flocking",
    },
    {
      id: "or-only",
      text: "steering behaviors without flocking",
      relative_path: "steering.md",
      heading_path: "Seek",
    },
    {
      id: "unrelated",
      text: "postgres indexes",
      relative_path: "sql.md",
      heading_path: "D1",
    },
    {
      id: "flock-leader",
      text: "flocks move without a leader using local rules",
      relative_path: "emergence.md",
      heading_path: "Leaderless",
    },
  ];

  it("returns AND matches first", async () => {
    const ids = await fetchCandidateChunkIds(
      createChunkDb(chunks),
      "boids steering",
      8
    );
    expect(ids[0]).toBe("and-both");
  });

  it("fills remaining slots with OR matches", async () => {
    const ids = await fetchCandidateChunkIds(
      createChunkDb(chunks),
      "boids steering",
      8
    );
    expect(ids).toContain("or-only");
    expect(ids).not.toContain("unrelated");
  });

  it("ignores stopwords so a natural-language question still gets candidates", async () => {
    const ids = await fetchCandidateChunkIds(
      createChunkDb(chunks),
      "how do flocks move without a leader",
      8
    );
    expect(ids[0]).toBe("flock-leader");
    expect(ids).not.toContain("unrelated");
  });
});
