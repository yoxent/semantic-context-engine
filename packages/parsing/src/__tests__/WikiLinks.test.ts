import { describe, expect, it } from "vitest";
import { extractWikiLinks } from "../WikiLinks.js";

describe("extractWikiLinks", () => {
  it("extracts plain and aliased links", () => {
    expect(extractWikiLinks("See [[Agent Context]] and [[Architecture|system design]].")).toEqual([
      "Agent Context",
      "Architecture"
    ]);
  });

  it("deduplicates links in encounter order", () => {
    expect(extractWikiLinks("[[A]] [[B]] [[A]]")).toEqual(["A", "B"]);
  });
});
