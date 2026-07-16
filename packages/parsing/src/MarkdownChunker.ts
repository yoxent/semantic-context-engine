import type { Chunk, ChunkInput, IChunker } from "@sce/core";
import { createHash } from "node:crypto";
import { extractWikiLinks } from "./WikiLinks.js";

interface Heading {
  level: number;
  title: string;
  line: number;
}

export class MarkdownChunker implements IChunker {
  chunk(input: ChunkInput): Chunk[] {
    const lines = input.text.replace(/\r\n/g, "\n").split("\n");
    const headings = findHeadings(lines);

    if (headings.length === 0) {
      return [this.createChunk(input, [], 1, trimTrailingEmptyLine(lines.length, lines), input.text)];
    }

    return headings.map((heading, index) => {
      const next = headings[index + 1];
      const startLine = heading.line;
      const endLine = next ? next.line - 1 : trimTrailingEmptyLine(lines.length, lines);
      const sectionText = lines.slice(startLine - 1, endLine).join("\n");
      return this.createChunk(input, headingPathFor(headings, index), startLine, endLine, sectionText);
    });
  }

  private createChunk(
    input: ChunkInput,
    headingPath: string[],
    startLine: number,
    endLine: number,
    text: string
  ): Chunk {
    return {
      id: createChunkId(input.repositoryId, input.relativePath, startLine, endLine, input.fileHash),
      repositoryId: input.repositoryId,
      relativePath: input.relativePath,
      language: input.language,
      startLine,
      endLine,
      text,
      fileHash: input.fileHash,
      timestamp: new Date(),
      headingPath,
      wikiLinks: extractWikiLinks(text)
    };
  }
}

function findHeadings(lines: string[]): Heading[] {
  return lines.flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) return [];
    const hashes = match[1]!;
    return [{ level: hashes.length, title: match[2]!, line: index + 1 }];
  });
}

function headingPathFor(headings: Heading[], index: number): string[] {
  const current = headings[index]!;
  const path: Heading[] = [current];

  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = headings[i]!;
    if (candidate.level < path[0]!.level) {
      path.unshift(candidate);
    }
  }

  return path.map((heading) => heading.title);
}

function trimTrailingEmptyLine(lineCount: number, lines: string[]): number {
  return lines.at(-1) === "" ? Math.max(1, lineCount - 1) : lineCount;
}

function createChunkId(repositoryId: string, relativePath: string, startLine: number, endLine: number, fileHash: string): string {
  return createHash("sha256")
    .update(`${repositoryId}:${relativePath}:${startLine}:${endLine}:${fileHash}`)
    .digest("hex");
}
