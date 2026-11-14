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
    unique: true,
    // Prune ignored directories during traversal instead of walking them and
    // filtering afterwards. Measured on a Unity project: `**/*.cs` went from
    // 8,575 files discovered to 458 once `**/Library/**` was applied here.
    ignore: options.ignore
  });

  return files
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => matcher(file))
    .sort();
}
