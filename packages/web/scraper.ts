/**
 * Atlassian Documentation Scraper
 *
 * Fetches pages from Atlassian developer docs sitemaps,
 * extracts content, and saves as markdown files.
 *
 * Usage:
 *   npx tsx packages/web/scraper.ts [output-dir]
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// --- Configuration ---

const SITEMAPS = [
  "https://developer.atlassian.com/cloud/confluence/sitemap.xml",
  "https://developer.atlassian.com/cloud/jira/platform/sitemap.xml",
  "https://developer.atlassian.com/cloud/jira/software/sitemap.xml",
];

const DELAY_MS = 500; // Delay between requests to be polite
const MAX_PAGES = 500; // Limit total pages

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchUrl(url: string): string {
  try {
    const result = execSync(`curl -sL --max-time 30 "${url}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return result;
  } catch {
    return "";
  }
}

function extractUrlsFromSitemap(sitemapUrl: string): string[] {
  const xml = fetchUrl(sitemapUrl);
  const urls: string[] = [];
  const regex = /<loc>([^<]*)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function htmlToMarkdown(html: string, url: string): string {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";

  // Try to find the main content area
  // Atlassian docs use various content containers
  let content = "";

  // Look for article or main content div
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<footer)/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1].length > 100) {
      content = match[1];
      break;
    }
  }

  // Fallback: extract everything between body tags
  if (!content) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : html;
  }

  // Convert HTML to basic markdown
  let md = content;

  // Remove script and style tags
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  md = md.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Remove HTML comments
  md = md.replace(/<!--[\s\S]*?-->/g, "");

  // Convert headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "###### $1\n\n");

  // Convert code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n\n");
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "```\n$1\n```\n\n");

  // Convert inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Convert links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Convert bold and italic
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

  // Convert lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Convert paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

  // Convert line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, " ");

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim();

  // Add metadata header
  const header = `---
title: "${title.replace(/"/g, '\\"')}"
source: "${url}"
---

# ${title}

`;

  return header + md;
}

function sanitizeFilename(url: string): string {
  // Convert URL to a safe filename
  return url
    .replace(/^https?:\/\/developer\.atlassian\.com\//, "")
    .replace(/\/$/, "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 100);
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const outputDir = resolve(args[0] || "./atlassian-docs");

  console.log(`Output directory: ${outputDir}`);
  mkdirSync(outputDir, { recursive: true });

  // Collect all URLs from sitemaps
  console.log("Fetching sitemaps...");
  const allUrls: string[] = [];
  for (const sitemap of SITEMAPS) {
    const urls = extractUrlsFromSitemap(sitemap);
    console.log(`  ${sitemap}: ${urls.length} URLs`);
    allUrls.push(...urls);
  }

  // Deduplicate
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`Total unique URLs: ${uniqueUrls.length}`);

  // Limit
  const urlsToFetch = uniqueUrls.slice(0, MAX_PAGES);
  console.log(`Fetching ${urlsToFetch.length} pages (limit: ${MAX_PAGES})...`);

  // Fetch and convert each page
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urlsToFetch.length; i++) {
    const url = urlsToFetch[i];
    const filename = sanitizeFilename(url) + ".md";
    const filepath = join(outputDir, filename);

    // Skip if already exists
    if (existsSync(filepath)) {
      successCount++;
      continue;
    }

    process.stdout.write(`\r  [${i + 1}/${urlsToFetch.length}] ${filename.substring(0, 60)}...`);

    const html = fetchUrl(url);
    if (!html || html.length < 100) {
      failCount++;
      continue;
    }

    const markdown = htmlToMarkdown(html, url);
    if (markdown.length < 50) {
      failCount++;
      continue;
    }

    writeFileSync(filepath, markdown, "utf-8");
    successCount++;

    // Be polite
    if (i < urlsToFetch.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n\nDone!");
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Output: ${outputDir}`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
