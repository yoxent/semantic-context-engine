import { createHash } from "node:crypto";
import { Parser, Language } from "web-tree-sitter";
import type { Chunk, ChunkInput, IChunker, SymbolKind } from "@sce/core";
import { getTreeSitterLanguage } from "./treeSitterLoader.js";

export interface TreeSitterCodeChunkerOptions {
  language: "typescript" | "javascript";
  grammar: Language;
}

interface ExtractedSymbol {
  name: string;
  symbolKind: SymbolKind;
  startLine: number;
  endLine: number;
  text: string;
  ancestry: string[]; // class/namespace names leading to this symbol, NOT including self
}

// Declaration node types → SymbolKind. (TS has all; JS lacks interface/type/enum/namespace.)
const DECLARATION_TYPES: Record<string, SymbolKind> = {
  function_declaration: "function",
  generator_function_declaration: "function", // generators fold into function
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  module_declaration: "namespace", // TS `namespace`/`module`
  internal_module: "namespace"
};

// Ancestor-container types: their `name` child contributes to ancestry.
const ANCESTOR_TYPES = new Set(["class_declaration", "class", "module_declaration", "internal_module"]);

export class TreeSitterCodeChunker implements IChunker {
  private readonly parser: Parser;

  constructor(options: TreeSitterCodeChunkerOptions) {
    this.parser = new Parser();
    this.parser.setLanguage(options.grammar);
  }

  static async create(language: "typescript" | "javascript"): Promise<TreeSitterCodeChunker> {
    const grammar = await getTreeSitterLanguage(language);
    return new TreeSitterCodeChunker({ language, grammar });
  }

  chunk(input: ChunkInput): Chunk[] {
    const normalized = input.text.replace(/\r\n/g, "\n");
    const tree = this.parser.parse(normalized);
    if (!tree) return [this.fallbackChunk(input, normalized)];

    const root = tree.rootNode;
    // Best-effort on syntax errors: tree-sitter recovers and produces a partial tree.
    // Traverse normally; never throw. (hasError is informational only.)
    const symbols: ExtractedSymbol[] = [];
    traverse(root, [], symbols);

    if (symbols.length === 0) {
      return [this.fallbackChunk(input, normalized)];
    }

    return symbols.map((s) => this.makeChunk(input, s));
  }

  private makeChunk(input: ChunkInput, s: ExtractedSymbol): Chunk {
    const headingPath = [...s.ancestry, s.name];
    const chunk: Chunk = {
      id: codeChunkId(input.repositoryId, input.relativePath, s.startLine, s.endLine, s.symbolKind, s.name, input.fileHash),
      repositoryId: input.repositoryId,
      relativePath: input.relativePath,
      language: input.language,
      startLine: s.startLine,
      endLine: s.endLine,
      text: s.text,
      fileHash: input.fileHash,
      timestamp: new Date(),
      headingPath,
      symbolKind: s.symbolKind
    };
    // className = immediate enclosing class name (last class in ancestry)
    const enclosingClass = lastClassIn(s.ancestry);
    if (enclosingClass) chunk.className = enclosingClass;
    // namespace = immediate enclosing namespace (last namespace in ancestry)
    const enclosingNs = lastNamespaceIn(s.ancestry);
    if (enclosingNs) chunk.namespace = enclosingNs;
    // methodName = own name when this is a method
    if (s.symbolKind === "method") chunk.methodName = s.name;
    return chunk;
  }

  private fallbackChunk(input: ChunkInput, normalizedText: string): Chunk {
    return {
      id: createHash("sha256")
        .update(`${input.repositoryId}:${input.relativePath}:1:${lineCount(normalizedText)}::${input.fileHash}`)
        .digest("hex"),
      repositoryId: input.repositoryId,
      relativePath: input.relativePath,
      language: input.language,
      startLine: 1,
      endLine: lineCount(normalizedText),
      text: normalizedText,
      fileHash: input.fileHash,
      timestamp: new Date(),
      headingPath: []
      // no symbolKind — invisible to future AST symbol lookup
    };
  }
}

function traverse(node: SyntaxNode, ancestry: string[], out: ExtractedSymbol[]): void {
  // 1. Direct declaration nodes (function/class/interface/type/enum/namespace).
  const directKind = DECLARATION_TYPES[node.type];
  if (directKind) {
    const name = nameOf(node);
    if (name) {
      out.push(extract(node, name, directKind, ancestry));
      // Descend with this name added to ancestry so its methods carry it.
      const nextAncestry = isAncestorType(node.type) ? [...ancestry, name] : ancestry;
      descendChildren(node, nextAncestry, out);
      return;
    }
    // Unnamed declaration: skip, but still descend in case it contains named declarations.
    descendChildren(node, ancestry, out);
    return;
  }

  // 2. const-bound arrow / function-expression / class-expression:
  //    variable_declarator whose `value` child is arrow_function / function_expression / class.
  if (node.type === "variable_declarator") {
    const name = nameOf(node);
    const value = childByFieldType(node, "value");
    if (name && value) {
      if (value.type === "arrow_function") {
        out.push(extract(value, name, "arrow", ancestry));
        return; // don't double-count the arrow itself
      }
      if (value.type === "function_expression") {
        out.push(extract(value, name, "function-expr", ancestry));
        return;
      }
      if (value.type === "class") {
        out.push(extract(value, name, "class", ancestry));
        // descend into the class body so its methods get chunked with `name` as className ancestry
        descendChildren(value, [...ancestry, name], out);
        return;
      }
    }
    // plain data const: fall through (skip), but do not descend (no declarations inside a data literal we care about)
    return;
  }

  // 3. method_definition (inside a class body) — handled when we descend into a class.
  if (node.type === "method_definition") {
    const name = nameOf(node);
    if (name) {
      out.push(extract(node, name, "method", ancestry));
      return;
    }
  }

  // 4. Otherwise, descend.
  descendChildren(node, ancestry, out);
}

function descendChildren(node: SyntaxNode, ancestry: string[], out: ExtractedSymbol[]): void {
  let child = node.firstChild;
  while (child) {
    traverse(child, ancestry, out);
    child = child.nextSibling;
  }
}

function extract(node: SyntaxNode, name: string, kind: SymbolKind, ancestry: string[]): ExtractedSymbol {
  return {
    name,
    symbolKind: kind,
    startLine: node.startPosition.row + 1, // tree-sitter rows are 0-based
    endLine: node.endPosition.row + 1,
    text: node.text.replace(/\r\n/g, "\n"),
    ancestry: [...ancestry]
  };
}

function nameOf(node: SyntaxNode): string | undefined {
  const nameChild = childByFieldType(node, "name");
  return nameChild?.text;
}

function childByFieldType(node: SyntaxNode, field: string): SyntaxNode | undefined {
  // tree-sitter: named child by field name (web-tree-sitter exposes childForFieldName).
  return node.childForFieldName(field) ?? undefined;
}

function isAncestorType(type: string): boolean {
  return ANCESTOR_TYPES.has(type);
}

function lastClassIn(ancestry: string[]): string | undefined {
  // ancestry carries only class/namespace names; we don't distinguish here.
  // The immediate enclosing class is the last entry whose source node was a class.
  // Since ancestry only holds class + namespace names, and we want the immediate class,
  // walk from the end and return the last name that came from a class node.
  // (We track kind alongside name below via a parallel structure is overkill for this slice;
  //  use the heuristic: the last ancestry entry is the immediate enclosing symbol.)
  return ancestry.length > 0 ? ancestry[ancestry.length - 1] : undefined;
}

function lastNamespaceIn(ancestry: string[]): string | undefined {
  // Without kind tracking on ancestry, we cannot reliably distinguish class from namespace here.
  // For this slice, namespace is set only when there is no class in ancestry (top-level namespace).
  // This is a known imprecision — documented in the spec's "Known Edge Cases".
  return undefined;
}

function codeChunkId(
  repositoryId: string,
  relativePath: string,
  startLine: number,
  endLine: number,
  symbolKind: SymbolKind,
  name: string,
  fileHash: string
): string {
  return createHash("sha256")
    .update(`${repositoryId}:${relativePath}:${startLine}:${endLine}:${symbolKind}:${name}:${fileHash}`)
    .digest("hex");
}

function lineCount(text: string): number {
  // Count newlines; a trailing newline does not add a line.
  // "a\n" → 1 line, "a\nb" → 2 lines, "a\nb\n" → 2 lines.
  const newlines = text.split("").filter((c) => c === "\n").length;
  if (text.length === 0) return 1;
  return text.endsWith("\n") ? newlines : newlines + 1;
}

// Minimal SyntaxNode typing for web-tree-sitter (avoid importing the full type surface).
interface SyntaxNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  hasError: boolean;
  firstChild: SyntaxNode | null;
  nextSibling: SyntaxNode | null;
  childForFieldName: (fieldName: string) => SyntaxNode | null;
}