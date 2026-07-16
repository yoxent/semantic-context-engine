export function extractWikiLinks(text: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const pattern = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const target = match[1]?.trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }

  return links;
}
