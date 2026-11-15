import type { SceConfig } from "./schema.js";

/**
 * Paths excluded from indexing unless a config overrides `indexing.ignore`.
 *
 * Every entry is prefixed with `**​/` so it matches at ANY depth. A bare
 * `node_modules/**` only matches the repository root, which silently indexes
 * `packages/x/node_modules/**` — the dominant source of noise in a monorepo.
 */
export const defaultIgnorePatterns = [
  // VCS + engine index state
  "**/.git/**",
  "**/.sce/**",
  "**/.svn/**",
  "**/.hg/**",
  // JavaScript/TypeScript build output + dependencies
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.open-next/**",
  "**/.turbo/**",
  "**/.wrangler/**",
  "**/.vercel/**",
  "**/.expo/**",
  "**/.vite/**",
  "**/.worktrees/**",
  "**/.superpowers/**",
  // .NET / C# build output (also appears inside Unity Assets/Plugins)
  "**/obj/**",
  "**/bin/**",
  "**/.vs/**",
  // Android / Gradle
  "**/.gradle/**",
  // Unity generated state (never edit these; they are rebuilt by the editor)
  "**/Library/**",
  "**/PackageCache/**",
  "**/Temp/**",
  "**/Logs/**",
  "**/UserSettings/**",
  "**/Build/**",
  "**/Builds/**",
  "**/MemoryCaptures/**",
  "**/Recordings/**",
  // Binary / non-text assets
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
