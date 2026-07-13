import { describe, expect, it } from "vitest";
import { buildPathFilterClause, escapeLike } from "../pathFilter.js";

describe("buildPathFilterClause", () => {
  it("returns undefined when pathFilter is undefined/empty", () => {
    expect(buildPathFilterClause(undefined, "t.col")).toBeUndefined();
    expect(buildPathFilterClause("", "t.col")).toBeUndefined();
  });

  it("uses GLOB when the filter has glob chars", () => {
    const clause = buildPathFilterClause("*.md", "t.col")!;
    expect(clause.sql).toBe("t.col GLOB ?");
    expect(clause.params).toEqual(["*.md"]);
  });

  it("uses exact OR prefix-LIKE for non-glob filters, against the given column", () => {
    const clause = buildPathFilterClause("notes/foo", "symbols.relative_path")!;
    expect(clause.sql).toBe("(symbols.relative_path = ? OR symbols.relative_path LIKE ? ESCAPE '\\')");
    expect(clause.params).toEqual(["notes/foo", "notes/foo/%"]);
  });

  it("escapes LIKE metacharacters in the prefix", () => {
    const clause = buildPathFilterClause("a_b%c", "t.col")!;
    expect(clause.params[1]).toBe("a\\_b\\%c/%");
  });
});

describe("escapeLike", () => {
  it("escapes backslash, percent, underscore", () => {
    expect(escapeLike("a_b%c\\d")).toBe("a\\_b\\%c\\\\d");
  });
});
