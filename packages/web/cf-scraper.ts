#!/usr/bin/env tsx
// Cloudflare Docs Scraper
// Usage: npx tsx packages/web/cf-scraper.ts <urls-file> <output-dir>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Ignore these elements
turndown.remove(['script', 'style', 'nav', 'footer', 'header', '.sidebar', '.breadcrumbs']);

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SCE-Scraper/1.0)',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.text();
  } catch (error) {
    return null;
  }
}

function extractContent(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(' | Cloudflare Docs', '').trim() : 'Untitled';
  
  // Extract main content (Cloudflare docs use <main> or <article>)
  let contentHtml = '';
  
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    contentHtml = mainMatch[1];
  } else {
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      contentHtml = articleMatch[1];
    } else {
      // Fallback to body
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      contentHtml = bodyMatch ? bodyMatch[1] : html;
    }
  }
  
  // Clean up HTML entities and tags
  contentHtml = contentHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  
  return { title, content: contentHtml };
}

function urlToFilename(url: string): string {
  return url
    .replace('https://developers.cloudflare.com/', '')
    .replace(/\/$/, '')
    .replace(/\//g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 100);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npx tsx packages/web/cf-scraper.ts <urls-file> <output-dir>');
    process.exit(1);
  }
  
  const urlsFile = resolve(args[0]);
  const outputDir = resolve(args[1]);
  
  console.log(`URLs file: ${urlsFile}`);
  console.log(`Output directory: ${outputDir}`);
  
  mkdirSync(outputDir, { recursive: true });
  
  // Read URLs
  const urls = readFileSync(urlsFile, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  
  console.log(`Total URLs: ${urls.length}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = urlToFilename(url);
    const filepath = `${outputDir}/${filename}.md`;
    
    // Skip if already exists
    if (existsSync(filepath)) {
      console.log(`[${i + 1}/${urls.length}] SKIP (exists): ${filename}`);
      successCount++;
      continue;
    }
    
    console.log(`[${i + 1}/${urls.length}] Fetching: ${url}`);
    
    const html = await fetchPage(url);
    if (!html) {
      console.log(`  FAILED`);
      failCount++;
      continue;
    }
    
    const { title, content } = extractContent(html);
    
    if (content.length < 50) {
      console.log(`  SKIPPED (too short: ${content.length} chars)`);
      failCount++;
      continue;
    }
    
    // Create markdown file
    const markdown = `# ${title}\n\nSource: ${url}\n\n${content}`;
    writeFileSync(filepath, markdown);
    
    console.log(`  OK (${content.length} chars)`);
    successCount++;
    
    // Be polite - don't hammer the server
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\nDone! ${successCount} success, ${failCount} failed`);
}

main();
