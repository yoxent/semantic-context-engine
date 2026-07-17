#!/usr/bin/env tsx
// Next.js RSC Scraper — extracts content from self.__next_f.push script chunks
// Usage: npx tsx packages/web/rsc-scraper.ts <urls-file> <output-dir>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SCE-Scraper/1.0)' },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch { return null; }
}

// Known noise strings from the RetroUI site shell
const NOISE_PHRASES = new Set([
  '404: This page could not be found.', 'This page could not be found.',
  'shadcn.io', 'RetroUI', 'A neobrutalist component library for React',
  'Product', 'Components', 'Blocks', 'Templates', 'Themes', 'Figma Kit',
  'Screenshot Studio', 'Resources', 'Documentation', 'Installation',
  'MCP Server', 'Blog', 'Showcase', 'Company', 'GitHub', 'Privacy Policy',
  'Terms of Use', 'Partners', 'countries.dev', 'nimiqhub.com', 'dov.me',
  'shadcn/ui', '1.5k', 'Introduction — RetroUI', 'Introduction',
  'All rights reserved.', 'A neobrutalist fork of', 'Source on',
  '★', 'Neobrutalism forever', 'Figma kit included', 'RTL ready',
  'Dark mode', 'MCP server support', 'Open source', '158 ready-made blocks',
  'Blocks & templates', 'Radix & Base UI', 'shadcn CLI compatible',
  '50+ components', 'Next', 'Previous',
]);

function extractRSCContent(html: string): { title: string; content: string } {
  // Extract title
  const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = ogTitle ? ogTitle[1] : (titleTag ? titleTag[1].replace(/\s*[-–—].*$/, '').trim() : 'Untitled');

  // Collect RSC chunks
  const chunks: string[] = [];
  const pushRegex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let match;
  while ((match = pushRegex.exec(html)) !== null) {
    chunks.push(match[1]);
  }

  const fullPayload = chunks.join('')
    .replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&');

  // Extract from markdown-like frontmatter blocks (---\n...\n---)
  const frontmatterBlocks: string[] = [];
  const fmRegex = /---\n([\s\S]*?)\n---/g;
  let fmMatch;
  while ((fmMatch = fmRegex.exec(fullPayload)) !== null) {
    const block = fmMatch[1].trim();
    // Only keep blocks that look like actual content, not metadata
    if (block.includes('description:') && block.length > 100) {
      frontmatterBlocks.push(block);
    }
  }

  // Extract "children" text values (the actual page content)
  const textParts: string[] = [];
  const childrenRegex = /"children":\[?"([^"]{5,})"?\]?/g;
  let cMatch;
  while ((cMatch = childrenRegex.exec(fullPayload)) !== null) {
    let text = cMatch[1]
      .replace(/\\u003c[^>]*\\u003e/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    // Filter noise
    if (text.length < 5 || NOISE_PHRASES.has(text)) continue;
    if (text.startsWith('self.__next_f')) continue;
    if (text.startsWith('$')) continue;
    if (text.startsWith('{')) continue;
    if (/^\d+[a-z]:/.test(text)) continue; // RSC chunk IDs
    textParts.push(text);
  }

  // Extract code commands (npm/yarn/pnpm/bun tabs)
  const codeCommands: string[] = [];
  const cmdRegex = /"__(npm|yarn|pnpm|bun)__":"([^"]+)"/g;
  let cmdMatch;
  while ((cmdMatch = cmdRegex.exec(fullPayload)) !== null) {
    if (cmdMatch[1] === 'npm' && !codeCommands.includes(cmdMatch[2])) {
      codeCommands.push(cmdMatch[2]);
    }
  }

  // Deduplicate text parts (by first 60 chars)
  const seen = new Set<string>();
  const uniqueParts = textParts.filter(t => {
    const key = t.substring(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let content = uniqueParts.join('\n\n');
  if (codeCommands.length > 0) {
    content += '\n\n## Commands\n\n' + codeCommands.map(c => `\`${c}\``).join('\n');
  }

  return { title, content };
}

function urlToFilename(url: string): string {
  return url
    .replace('https://retroui.dev/', '')
    .replace(/\/$/, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 100);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npx tsx packages/web/rsc-scraper.ts <urls-file> <output-dir>');
    process.exit(1);
  }

  const urlsFile = resolve(args[0]);
  const outputDir = resolve(args[1]);
  mkdirSync(outputDir, { recursive: true });

  const urls = readFileSync(urlsFile, 'utf-8')
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  console.log(`Total URLs: ${urls.length}`);
  let success = 0, fail = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = urlToFilename(url);
    const filepath = `${outputDir}/${filename}.md`;

    if (existsSync(filepath)) {
      console.log(`[${i + 1}/${urls.length}] SKIP: ${filename}`);
      success++;
      continue;
    }

    console.log(`[${i + 1}/${urls.length}] ${url}`);
    const html = await fetchPage(url);
    if (!html) { console.log('  FAILED'); fail++; continue; }

    const { title, content } = extractRSCContent(html);
    if (content.length < 50) {
      console.log(`  SKIPPED (too short: ${content.length})`);
      fail++;
      continue;
    }

    const markdown = `# ${title}\n\nSource: ${url}\n\n${content}`;
    writeFileSync(filepath, markdown);
    console.log(`  OK (${content.length} chars)`);
    success++;

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone! ${success} success, ${fail} failed`);
}

main();
