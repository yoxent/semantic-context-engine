import { Parser, Language } from "web-tree-sitter";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

type CodeLanguage = "typescript" | "javascript";

const GRAMMAR_FILES: Record<CodeLanguage, string> = {
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm"
};

let runtimeInitialized = false;
const languageCache = new Map<CodeLanguage, Language>();

function grammarDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // Works both from source (packages/parsing/src/ → ../grammars)
  // and from the built module (dist/src/ → ../../grammars).
  const candidates = [join(here, "..", "grammars"), join(here, "..", "..", "grammars")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  // Fall back to the built-module path so the error message is stable.
  return join(here, "..", "..", "grammars");
}

async function ensureRuntime(): Promise<void> {
  if (runtimeInitialized) return;
  await Parser.init();
  runtimeInitialized = true;
}

export async function getTreeSitterLanguage(language: CodeLanguage): Promise<Language> {
  const cached = languageCache.get(language);
  if (cached) return cached;

  await ensureRuntime();
  const file = GRAMMAR_FILES[language];
  const path = join(grammarDir(), file);
  if (!existsSync(path)) {
    throw new Error(
      `Failed to load tree-sitter grammar: ${file} not found at ${path}. ` +
        `The @sce/parsing package may not be installed correctly.`
    );
  }
  let lang: Language;
  try {
    lang = await Language.load(path);
  } catch (cause) {
    throw new Error(`Failed to load tree-sitter grammar: ${path} (${cause instanceof Error ? cause.message : String(cause)})`);
  }
  languageCache.set(language, lang);
  return lang;
}

/** Test-only: reset memoization so tests can re-init cleanly. Not for production use. */
export function __resetTreeSitterLoaderForTests(): void {
  languageCache.clear();
  runtimeInitialized = false;
}