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

  // Regression: default patterns used to be root-anchored (e.g. "node_modules/**"),
  // so a monorepo silently indexed every nested packages/*/node_modules/**.
  // 1,676 of 3,221 chunks in this repo's own index came from nested node_modules READMEs.
  it("excludes default ignored paths at any depth", () => {
    const matcher = createIgnoreMatcher({ include: ["**/*.md"], ignore: [] });
    expect(matcher("packages/core/node_modules/pkg/README.md")).toBe(false);
    expect(matcher("packages/web/worker/node_modules/zod/README.md")).toBe(false);
    expect(matcher("packages/cli/dist/src/README.md")).toBe(false);
    expect(matcher("packages/.sce/metadata.sqlite")).toBe(false);
    expect(matcher("packages/core/.git/config")).toBe(false);
  });

  it("excludes Unity and .NET generated folders at any depth", () => {
    const matcher = createIgnoreMatcher({ include: ["**/*.cs", "**/*.md"], ignore: [] });
    expect(matcher("Library/PackageCache/com.unity.x/README.md")).toBe(false);
    expect(matcher("Library/PackageCache/com.unity.x/Editor/A.cs")).toBe(false);
    expect(matcher("Assets/ThirdParty/Library/README.md")).toBe(false);
    expect(matcher("Logs/Package.log")).toBe(false);
    expect(matcher("obj/Debug/README.md")).toBe(false);
    expect(matcher("Assets/Plugins/SDK/obj/A.cs")).toBe(false);
    expect(matcher("Builds/Win64/README.md")).toBe(false);
    // Real source must survive these rules.
    expect(matcher("Assets/Scripts/Player.cs")).toBe(true);
    expect(matcher("Assets/TextMesh Pro/README.md")).toBe(true);
  });
});
