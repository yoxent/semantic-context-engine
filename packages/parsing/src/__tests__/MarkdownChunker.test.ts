import { describe, expect, it } from "vitest";
import { MarkdownChunker } from "../MarkdownChunker.js";

const chunker = new MarkdownChunker();

describe("MarkdownChunker", () => {
  it("creates one file-level chunk when no headings exist", () => {
    const chunks = chunker.chunk({
      repositoryId: "repo",
      relativePath: "note.md",
      language: "markdown",
      fileHash: "hash",
      text: "One\nTwo\n[[Agent Context]]\n"
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.startLine).toBe(1);
    expect(chunks[0]?.endLine).toBe(3);
    expect(chunks[0]?.headingPath).toEqual([]);
    expect(chunks[0]?.wikiLinks).toEqual(["Agent Context"]);
  });

  it("chunks heading sections with nested heading paths", () => {
    const chunks = chunker.chunk({
      repositoryId: "repo",
      relativePath: "Architecture.md",
      language: "markdown",
      fileHash: "hash",
      text: "# Architecture\nIntro\n## Storage\nSQLite\n## Retrieval\nKeyword\n"
    });

    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([
      ["Architecture"],
      ["Architecture", "Storage"],
      ["Architecture", "Retrieval"]
    ]);
    expect(chunks.map((chunk) => [chunk.startLine, chunk.endLine])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6]
    ]);
  });
});
