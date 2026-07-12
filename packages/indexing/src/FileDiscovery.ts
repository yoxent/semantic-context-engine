import fg from "fast-glob";
import { createIgnoreMatcher } from "./IgnoreRules.js";

export interface DiscoverFilesOptions {
  rootPath: string;
  include: string[];
  ignore: string[];
}

export async function discoverFiles(options: DiscoverFilesOptions): Promise<string[]> {
  const matcher = createIgnoreMatcher({ include: options.include, ignore: options.ignore });
  const files = await fg(options.include, {
    cwd: options.rootPath,
    onlyFiles: true,
    dot: true,
    unique: true
  });

  return files
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => matcher(file))
    .sort();
}
