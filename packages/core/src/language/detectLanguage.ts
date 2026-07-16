import type { Language } from "../models/Language.js";

const EXTENSION_MAP: Record<string, Language> = {
  md: "markdown",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript"
};

export function detectLanguage(relativePath: string): Language {
  const dot = relativePath.lastIndexOf(".");
  if (dot < 0) return "text";
  const ext = relativePath.slice(dot + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? "text";
}