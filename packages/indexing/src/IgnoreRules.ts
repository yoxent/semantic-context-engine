import ignore from "ignore";
import { defaultIgnorePatterns } from "@sce/core";

export interface IgnoreRuleInput {
  include: string[];
  ignore: string[];
}

export function createIgnoreMatcher(input: IgnoreRuleInput): (relativePath: string) => boolean {
  const ignored = ignore().add([...defaultIgnorePatterns, ...input.ignore]);
  const included = ignore().add(input.include.length > 0 ? input.include : ["**/*"]);

  return (relativePath: string): boolean => {
    const normalized = relativePath.replace(/\\/g, "/");
    if (ignored.ignores(normalized)) {
      return false;
    }
    // included.ignores() acts as a positive include match
    return included.ignores(normalized);
  };
}
