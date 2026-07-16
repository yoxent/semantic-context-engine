import { describe, expect, it } from "vitest";
import { createIgnoreMatcher } from "../IgnoreRules.js";

describe("createIgnoreMatcher", () => {
  it("excludes default ignored paths", () => {
    const matcher = createIgnoreMatcher({ include: ["**/*.md"], ignore: [] });
    expect(matcher("README.md")).toBe(true);
    expect(matcher(".git/config")).toBe(false);
    expect(matcher(".sce/metadata.sqlite")).toBe(false);
    expect(matcher("node_modules/pkg/index.js")).toBe(false);
    expect(matcher("dist/app.js")).toBe(false);
  });

  it("lets includes narrow indexed files", () => {
    const matcher = createIgnoreMatcher({ include: ["notes/**/*.md"], ignore: ["notes/private/**"] });
    expect(matcher("notes/public/idea.md")).toBe(true);
    expect(matcher("notes/private/secret.md")).toBe(false);
    expect(matcher("src/index.ts")).toBe(false);
  });
});
