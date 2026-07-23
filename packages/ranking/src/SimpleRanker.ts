import type { IRanker, SearchHit, SearchQuery } from "@sce/core";

const TERM_RE = /[\p{L}\p{N}_]+/gu;

export class SimpleRanker implements IRanker {
  rank(hits: SearchHit[], query: SearchQuery): SearchHit[] {
    const needle = query.text.trim().toLowerCase();
    const terms = tokenize(query.text);
    const identifierQuery = isIdentifierLike(query.text.trim());
    const isMultiWord = terms.length > 1;

    const ranked = hits.map((hit) => {
      let score = hit.score;
      const pathLower = hit.path.toLowerCase();
      const fileName = fileNameFromPath(hit.path).toLowerCase();
      const stem = fileStem(fileName);
      const snippetLower = hit.snippet.toLowerCase();
      const headings = (hit.headingPath ?? []).map((part) => part.toLowerCase());

      if (needle) {
        // === FILENAME BOOSTS ===
        if (stem === needle || fileName === needle + '.md') {
          score += 8;
        } else if (fileName.includes(needle)) {
          score += 6;
        } else if (terms.every(t => fileName.includes(t))) {
          score += 5;
        } else {
          const termHits = terms.filter(t => fileName.includes(t)).length;
          if (termHits > 0) {
            score += Math.min(termHits * 3, 4);
          }
        }

        // === HEADING BOOSTS ===
        const headingHits = headings.filter(
          (heading) => heading === needle || heading.includes(needle) || terms.some((term) => heading === term || heading.includes(term))
        ).length;
        if (headingHits > 0) {
          score += 4 + Math.min(headingHits - 1, 3);
        }

        // === CONTENT/TEXT BOOSTS ===
        if (snippetLower.includes(needle)) {
          score += 4;
        } else if (isMultiWord) {
          let lastIdx = -1;
          let allInOrder = true;
          for (const term of terms) {
            const idx = snippetLower.indexOf(term, lastIdx + 1);
            if (idx === -1) {
              allInOrder = false;
              break;
            }
            lastIdx = idx;
          }
          if (allInOrder) {
            score += 3;
          }
        }

        if (terms.every(t => snippetLower.includes(t))) {
          score += 2;
        }

        // === QUALITY SIGNALS ===
        if (hit.snippet.length > 1000) {
          score += 2;
        } else if (hit.snippet.length > 500) {
          score += 1;
        }

        if (identifierQuery && hasIdentifierMatch(hit.snippet, needle)) {
          score += 3;
        }
      }

      return { ...hit, score };
    });

    return ranked
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const byPath = a.path.localeCompare(b.path);
        if (byPath !== 0) return byPath;
        return a.chunkId.localeCompare(b.chunkId);
      })
      .slice(0, query.limit ?? ranked.length);
  }
}

function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(TERM_RE), (match) => match[0]).filter(Boolean);
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

function fileStem(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** camelCase, snake_case, dotted, or kebab identifiers — not plain TitleCase words. */
function isIdentifierLike(text: string): boolean {
  if (!text || /\s/.test(text)) return false;
  return /[_./-]/.test(text) || /[a-z][A-Z]/.test(text);
}

function hasIdentifierMatch(snippet: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu").test(snippet);
}
