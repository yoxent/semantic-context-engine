import type { SceConfig } from "./schema.js";

export const defaultIgnorePatterns = [
  ".git/**",
  ".sce/**",
  "node_modules/**",
  "dist/**",
  "build/**",
  "coverage/**",
  "Library/**",
  "Temp/**",
  "obj/**",
  "bin/**",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.webp",
  "**/*.pdf",
  "**/*.zip"
];

export const defaultConfig: SceConfig = {
  repositories: [],
  indexing: {
    include: ["**/*.md"],
    ignore: defaultIgnorePatterns
  },
  search: {
    defaultLimit: 10,
    maxSnippetChars: 500
  },
  logging: {
    level: "info"
  }
};
