#!/usr/bin/env node
/**
 * Scrape ORK 4 system documentation into knowledge/ork-framework.
 *
 * Source: https://orkframework.com/guide/ork4/ork4-documentation/
 * Scope: the ORK 4 reference (system design). Tutorials, the blog, and the
 * ORK 2 hub are left out — they are editor walkthroughs or older products.
 *
 * Usage: node scripts/scrape-ork-framework.mjs
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const topicDir = join(root, "knowledge", "ork-framework");
const urlFile = join(root, "knowledge", "urls", "ork-framework.txt");
const sitemapUrl = "https://orkframework.com/docs-sitemap.xml";
const ua = "Mozilla/5.0 (compatible; SCE-Scraper/1.0)";

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"');
}

function stripTags(html) {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function removeBalancedDiv(html, classNeedle) {
  const re = new RegExp(`<div\\b[^>]*class="[^"]*${classNeedle}[^"]*"[^>]*>`, "i");
  let out = html;
  for (;;) {
    const match = re.exec(out);
    if (!match) return out;
    const start = match.index;
    const tagRe = /<\/?div\b[^>]*>/gi;
    tagRe.lastIndex = start;
    let depth = 0;
    let end = -1;
    let tag;
    while ((tag = tagRe.exec(out))) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = tagRe.lastIndex;
        break;
      }
    }
    if (end < 0) return out.slice(0, start) + out.slice(start + match[0].length);
    out = out.slice(0, start) + out.slice(end);
  }
}

function htmlToMarkdown(html) {
  let src = html;
  src = src.replace(/<script[\s\S]*?<\/script>/gi, "");
  src = src.replace(/<style[\s\S]*?<\/style>/gi, "");
  src = src.replace(/<a\b[^>]*batterdocs-anchor[^>]*>[\s\S]*?<\/a>/gi, "");
  src = src.replace(/<span\b[^>]*id="more-\d+"[^>]*>\s*<\/span>/gi, "");
  src = removeBalancedDiv(src, "betterdocs-toc");
  src = removeBalancedDiv(src, "betterdocs-ai-actions");

  src = src.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const text = stripTags(inner);
    return text ? `\n\n${"#".repeat(Number(level))} ${text}\n\n` : "\n\n";
  });

  src = src.replace(/<li\b[^>]*>/gi, "\n- ");
  src = src.replace(/<\/li>/gi, "");
  src = src.replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n");
  src = src.replace(/<br\s*\/?>/gi, "\n");
  src = src.replace(/<\/p>/gi, "\n\n");
  src = src.replace(/<p\b[^>]*>/gi, "");
  src = src.replace(/<\/(strong|b)>/gi, "**");
  src = src.replace(/<(strong|b)\b[^>]*>/gi, "**");
  src = src.replace(/<\/(em|i)>/gi, "*");
  src = src.replace(/<(em|i)\b[^>]*>/gi, "*");
  src = src.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_, inner) => stripTags(inner));

  src = src.replace(/<tr\b[^>]*>/gi, "\n");
  src = src.replace(/<\/tr>/gi, "");
  src = src.replace(/<t[dh]\b[^>]*>/gi, "| ");
  src = src.replace(/<\/t[dh]>/gi, " ");
  src = src.replace(/<\/?(table|thead|tbody|tfoot)\b[^>]*>/gi, "\n");

  src = src.replace(/<[^>]+>/g, "");
  src = decode(src).replace(/\u00a0/g, " ");
  src = src.replace(/[ \t]+\n/g, "\n");
  src = src.replace(/\n{3,}/g, "\n\n");
  src = src.replace(/\*{4,}/g, "**");
  src = src.replace(/^[ \t]+$/gm, "");
  const lines = src.trim().split("\n");
  while (lines.length && /^\s*<[a-zA-Z][^>]*$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join("\n").trim();
}

function extractArticle(html) {
  const marker = 'id="betterdocs-single-content"';
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const openEnd = html.indexOf(">", start);
  if (openEnd < 0) return "";
  const endMarkers = [
    'id="betterdocs-sidebar-right"',
    "betterdocs-article-reactions",
    "betterdocs-footer",
  ];
  let end = -1;
  for (const markerName of endMarkers) {
    const at = html.indexOf(markerName, openEnd);
    if (at > openEnd && (end < 0 || at < end)) end = at;
  }
  const slice = html.slice(openEnd + 1, end > openEnd ? end : openEnd + 80000);
  return htmlToMarkdown(slice);
}

function pageTitle(html, url) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const raw = match ? decode(match[1]) : "";
  const cleaned = raw.replace(/\s+[-|]\s+ORK.*$/i, "").trim();
  if (cleaned) return cleaned;
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) || "ORK 4";
  return slug.replace(/-/g, " ");
}

function toFilename(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const section = (parts[3] || "general")
    .replace(/^section-/, "")
    .replace(/^sections-/, "")
    .replace(/^ork4-/, "");
  const slug = (parts[4] || "index").replace(/^ork4-/, "");
  const name = `ork4-${section}-${slug}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return `${name}.md`;
}

async function fetchText(url, attempt = 1) {
  const response = await fetch(url, { headers: { "User-Agent": ua }, redirect: "follow" });
  if (!response.ok) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return fetchText(url, attempt + 1);
    }
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  mkdirSync(topicDir, { recursive: true });
  mkdirSync(dirname(urlFile), { recursive: true });
  rmSync(join(root, "knowledge", "urls", "_write_test.txt"), { force: true });

  const sitemap = await fetchText(sitemapUrl);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => url.includes("/ork4-documentation/") && !url.endsWith("/ork4-documentation/"));

  const lines = [
    "# ORK 4 RPG Framework — system documentation",
    "# Blueprint for our own Unity gameplay systems. Source: https://orkframework.com/",
    "# Scope: ORK 4 reference pages. Tutorials, blog, and ORK 2 hub are excluded.",
    "# Unity 6000.3 primitives these systems sit on are already indexed:",
    "#   ScriptableObjects, events, coroutines, scene management, object pooling, UI.",
    ...urls,
    "",
  ];
  writeFileSync(urlFile, lines.join("\n"));

  let ok = 0;
  let failed = 0;
  const failures = [];
  const written = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const filename = toFilename(url);
    process.stdout.write(`[${i + 1}/${urls.length}] ${filename} `);
    try {
      const html = await fetchText(url);
      const title = pageTitle(html, url);
      const body = extractArticle(html);
      if (body.length < 80) {
        failed++;
        failures.push(`${url} (short: ${body.length})`);
        console.log(`SHORT ${body.length}`);
        continue;
      }
      const markdown = `# ${title}\n\nSource: ${url}\n\n${body}\n`;
      writeFileSync(join(topicDir, filename), markdown);
      written.push({ filename, url, chars: markdown.length });
      ok++;
      console.log(`OK ${markdown.length}`);
    } catch (error) {
      failed++;
      failures.push(`${url} (${error.message})`);
      console.log(`FAIL ${error.message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nWrote ${ok} pages, ${failed} failed, ${written.reduce((n, file) => n + file.chars, 0)} chars`);
  if (failures.length) console.log(failures.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
