import { describe, expect, it } from "vitest";
import { LanguageChunkerRegistry } from "../LanguageChunkerRegistry.js";
import { MarkdownChunker } from "../MarkdownChunker.js";
import type { Chunk, IChunker } from "@sce/core";

function stubChunker(label: string): IChunker {
  return {
    chunk: () => [
      {
        id: `stub-${label}`,
        repositoryId: "r",
        relativePath: "f",
        language: "text",
        startLine: 1,
        endLine: 1,
        text: label,
        fileHash: "h",
        timestamp: new Date()
      }
    ]
  };
}

describe("LanguageChunkerRegistry", () => {
  it("routes markdown input to the markdown chunker", () => {
    const registry = new LanguageChunkerRegistry({
      chunkers: { markdown: new MarkdownChunker() }
    });
    const chunks = registry.chunk({
      repositoryId: "r",
      relativePath: "Notes.md",
      language: "markdown",
      fileHash: "h",
      text: "# Title\nbody\n"
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.headingPath?.[0]).toBe("Title");
  });

  it("routes typescript input to the typescript chunker", () => {
    const ts = stubChunker("ts");
    const registry = new LanguageChunkerRegistry({
      chunkers: { markdown: new MarkdownChunker(), typescript: ts }
    });
    const chunks = registry.chunk({
      repositoryId: "r",
      relativePath: "f.ts",
      language: "typescript",
      fileHash: "h",
      text: "function foo() {}"
    });
    expect(chunks[0]?.text).toBe("ts");
  });

  it("throws when no chunker is registered for the input language", () => {
    const registry = new LanguageChunkerRegistry({
      chunkers: { markdown: new MarkdownChunker() }
    });
    expect(() =>
      registry.chunk({ repositoryId: "r", relativePath: "f.ts", language: "typescript", fileHash: "h", text: "x" })
    ).toThrow(/No chunker registered for language: typescript/);
  });
});