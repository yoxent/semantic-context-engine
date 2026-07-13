import { describe, expect, it } from "vitest";
import { detectLanguage } from "../detectLanguage.js";

describe("detectLanguage", () => {
  it("maps Markdown extensions to markdown", () => {
    expect(detectLanguage("Notes/Alpha.md")).toBe("markdown");
    expect(detectLanguage("README.MD")).toBe("markdown");
  });

  it("maps TypeScript extensions to typescript", () => {
    expect(detectLanguage("src/index.ts")).toBe("typescript");
    expect(detectLanguage("src/Component.tsx")).toBe("typescript");
    expect(detectLanguage("src/types.mts")).toBe("typescript");
    expect(detectLanguage("src/config.cts")).toBe("typescript");
  });

  it("maps JavaScript extensions to javascript", () => {
    expect(detectLanguage("src/index.js")).toBe("javascript");
    expect(detectLanguage("src/Component.jsx")).toBe("javascript");
    expect(detectLanguage("src/types.mjs")).toBe("javascript");
    expect(detectLanguage("src/config.cjs")).toBe("javascript");
  });

  it("maps unknown extensions and extensionless paths to text", () => {
    expect(detectLanguage("data/config.json")).toBe("text");
    expect(detectLanguage("data/notes.yaml")).toBe("text");
    expect(detectLanguage("bin/run")).toBe("text");
    expect(detectLanguage("Makefile")).toBe("text");
  });

  it("is case-insensitive on extensions", () => {
    expect(detectLanguage("src/X.TS")).toBe("typescript");
    expect(detectLanguage("src/X.Js")).toBe("javascript");
  });
});