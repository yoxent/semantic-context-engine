import { describe, expect, it } from "vitest";
import { TreeSitterCodeChunker } from "../TreeSitterCodeChunker.js";
import type { Chunk } from "@sce/core";

const baseInput = {
  repositoryId: "repo-a",
  relativePath: "src/foo.ts",
  fileHash: "hash-1",
  text: ""
};

async function tsChunker(): Promise<TreeSitterCodeChunker> {
  return TreeSitterCodeChunker.create("typescript");
}

function findChunk(chunks: Chunk[], symbolKind: string, name?: string): Chunk | undefined {
  return chunks.find((c) => c.symbolKind === symbolKind && (name === undefined || c.headingPath?.at(-1) === name));
}

describe("TreeSitterCodeChunker — declaration kinds", () => {
  it("chunks a function declaration", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "function foo(): void {\n  return;\n}\n" });
    const fn = findChunk(chunks, "function", "foo");
    expect(fn).toBeDefined();
    expect(fn?.symbolKind).toBe("function");
    expect(fn?.headingPath).toEqual(["foo"]);
    expect(fn?.startLine).toBe(1);
    expect(fn?.endLine).toBe(3);
    expect(fn?.text).toContain("function foo(): void");
  });

  it("chunks a class with a method (method has className, class chunk = whole body)", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: "class Foo {\n  bar(): void {\n    return;\n  }\n}\n"
    });
    const cls = findChunk(chunks, "class", "Foo");
    const method = findChunk(chunks, "method", "bar");
    expect(cls).toBeDefined();
    expect(method).toBeDefined();
    expect(cls?.headingPath).toEqual(["Foo"]);
    expect(method?.headingPath).toEqual(["Foo", "bar"]);
    expect(method?.className).toBe("Foo");
    expect(method?.methodName).toBe("bar");
    expect(cls?.startLine).toBe(1);
    expect(cls?.endLine).toBe(5);
    expect(method?.startLine).toBe(2);
    // class chunk text includes the whole body (overlaps method range)
    expect(cls?.text).toContain("bar(): void");
  });

  it("chunks a const-bound arrow function as arrow", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "const f = () => 1;\n" });
    const arrow = findChunk(chunks, "arrow", "f");
    expect(arrow).toBeDefined();
    expect(arrow?.symbolKind).toBe("arrow");
    expect(arrow?.text).toContain("f"); // binding name is in the chunk text (Fix 2)
  });

  it("chunks a const-bound function expression as function-expr", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "const f = function () { return 1; };\n" });
    const fe = findChunk(chunks, "function-expr", "f");
    expect(fe).toBeDefined();
    expect(fe?.symbolKind).toBe("function-expr");
  });

  it("chunks a const-bound class expression as class (name from binding)", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: "const Foo = class {\n  bar() { return 1; }\n};\n"
    });
    const cls = findChunk(chunks, "class", "Foo");
    expect(cls).toBeDefined();
    expect(cls?.symbolKind).toBe("class");
    expect(cls?.headingPath).toEqual(["Foo"]);
  });

  it("chunks interface, type, enum, and namespace declarations", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: [
        "interface Foo { x: number; }",
        "type Bar = string | number;",
        "enum Baz { A, B, C }",
        "namespace Ns { export const v = 1; }"
      ].join("\n")
    });
    expect(findChunk(chunks, "interface", "Foo")).toBeDefined();
    expect(findChunk(chunks, "type", "Bar")).toBeDefined();
    expect(findChunk(chunks, "enum", "Baz")).toBeDefined();
    expect(findChunk(chunks, "namespace", "Ns")).toBeDefined();
  });

  it("skips plain data const declarations", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "const PI = 3.14;\nconst name = 'sce';\n" });
    expect(chunks.filter((c) => c.symbolKind === "arrow" || c.symbolKind === "function-expr")).toEqual([]);
  });

  it("skips unnamed declarations", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "export default function () { return 1; }\n" });
    expect(chunks.filter((c) => c.symbolKind === "function")).toEqual([]);
  });

  it("chunks named export declarations (export function / export const)", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({
      ...baseInput,
      language: "typescript",
      text: "export function exported() { return 1; }\nexport const arrow = () => 2;\n"
    });
    expect(findChunk(chunks, "function", "exported")).toBeDefined();
    expect(findChunk(chunks, "arrow", "arrow")).toBeDefined();
  });

  it("does not collide ids for one-line class with one-line method", async () => {
    const chunker = await tsChunker();
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text: "class Foo { bar() {} }\n" });
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
    expect(chunks.length).toBeGreaterThanOrEqual(2); // class + method
  });
});

describe("TreeSitterCodeChunker — fallback and errors", () => {
  it("emits one whole-file fallback chunk when a code file has zero declarations", async () => {
    const chunker = await tsChunker();
    const text = "import { x } from './y';\nconsole.log(x);\n";
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.symbolKind).toBeUndefined();
    expect(chunks[0]?.headingPath).toEqual([]);
    expect(chunks[0]?.text).toBe(text.replace(/\r\n/g, "\n"));
    expect(chunks[0]?.startLine).toBe(1);
  });

  it("best-effort chunks a file with a syntax error, recovers valid declarations, and logs hasError", async () => {
    const calls: { message: string; relativePath: string }[] = [];
    const logger = {
      level: "debug" as const,
      debug: (message: string, meta?: Record<string, unknown>) =>
        calls.push({ message, relativePath: (meta?.relativePath as string) ?? "" }),
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      child: () => logger
    } as any;
    const chunker = await TreeSitterCodeChunker.create("typescript", logger);
    const text = "function foo() {\n  return\nfunction good() { return 1; }\n"; // unbalanced
    const chunks = chunker.chunk({ ...baseInput, language: "typescript", text });
    expect(Array.isArray(chunks)).toBe(true);
    // `good` is a valid declaration that tree-sitter recovers
    expect(chunks.some((c) => c.symbolKind === "function" && c.headingPath?.at(-1) === "good")).toBe(true);
    // the hasError debug log fired
    expect(calls.some((c) => c.message === "parse.hasError")).toBe(true);
  });
});

describe("TreeSitterCodeChunker — JavaScript", () => {
  it("chunks a JS function and const arrow (no interface/type/enum in JS)", async () => {
    const chunker = await TreeSitterCodeChunker.create("javascript");
    const chunks = chunker.chunk({
      ...baseInput,
      relativePath: "src/foo.js",
      language: "javascript",
      text: "function foo() { return 1; }\nconst bar = () => 2;\n"
    });
    expect(findChunk(chunks, "function", "foo")).toBeDefined();
    expect(findChunk(chunks, "arrow", "bar")).toBeDefined();
  });
});