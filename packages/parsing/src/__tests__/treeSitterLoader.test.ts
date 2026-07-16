import { describe, expect, it } from "vitest";
import { getTreeSitterLanguage } from "../treeSitterLoader.js";

describe("treeSitterLoader", () => {
  it("loads the TypeScript grammar and can parse a function declaration", async () => {
    const { Parser } = await import("web-tree-sitter");
    await Parser.init();
    const lang = await getTreeSitterLanguage("typescript");
    expect(lang).toBeDefined();
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse("function foo(): void {}");
    expect(tree?.rootNode.hasError).toBe(false);
    expect(tree?.rootNode.firstChild?.type).toBe("function_declaration");
  });

  it("loads the JavaScript grammar and can parse a function declaration", async () => {
    const { Parser } = await import("web-tree-sitter");
    await Parser.init();
    const lang = await getTreeSitterLanguage("javascript");
    const parser = new Parser();
    parser.setLanguage(lang);
    const tree = parser.parse("function foo() {}");
    expect(tree?.rootNode.hasError).toBe(false);
    expect(tree?.rootNode.firstChild?.type).toBe("function_declaration");
  });

  it("memoizes: a second call returns the same language object", async () => {
    const a = await getTreeSitterLanguage("typescript");
    const b = await getTreeSitterLanguage("typescript");
    expect(a).toBe(b);
  });
});