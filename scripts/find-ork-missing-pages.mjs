#!/usr/bin/env node
/**
 * Find ORK documentation links that are not in the live sitemap.
 * Writes knowledge/urls/ork-framework-article-links.txt
 *
 * Usage: node scripts/find-ork-missing-pages.mjs [start] [end]
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "knowledge", "urls", "ork-framework-article-links.txt");
const ua = "Mozilla/5.0 (compatible; SCE-Scraper/1.0)";
const start = Number(process.argv[2] ?? 0);
const end = Number(process.argv[3] ?? 9999);

async function get(url, attempt = 1) {
  try {
    return await fetch(url, { headers: { "User-Agent": ua }, redirect: "follow" });
  } catch (error) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return get(url, attempt + 1);
    }
    throw error;
  }
}

const sitemap = await (await get("https://orkframework.com/docs-sitemap.xml")).text();
const known = new Set(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(/\/$/, ""))
);
const seeds = [...known].filter((url) => url.includes("/ork4-documentation/")).slice(start, end);
const found = new Set();
let failed = 0;

for (const url of seeds) {
  try {
    const html = await (await get(url)).text();
    const contentAt = html.indexOf('id="betterdocs-single-content"');
    const open = contentAt < 0 ? -1 : html.indexOf(">", contentAt);
    const endAt = open < 0 ? -1 : html.indexOf('id="betterdocs-sidebar-right"', open);
    const slice = open < 0 ? "" : html.slice(open + 1, endAt > open ? endAt : open + 80000);
    for (const match of slice.matchAll(/href\s*=\s*"([^"]+)"/gi)) {
      let href = match[1].split("#")[0].split("?")[0];
      if (href.startsWith("/")) href = `https://orkframework.com${href}`;
      if (!href.startsWith("https://orkframework.com/")) continue;
      if (/\.(png|jpe?g|gif|webp|svg|unitypackage|pdf)$/i.test(href)) continue;
      found.add(href.replace(/\/$/, ""));
    }
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${url} ${error.message}`);
  }
}

const unknown = [...found].filter((url) => !known.has(url)).sort();
mkdirSync(dirname(outFile), { recursive: true });
if (start === 0) writeFileSync(outFile, "");
if (unknown.length) appendFileSync(outFile, `${unknown.join("\n")}\n`);
console.log(
  `batch ${start}-${end} seeds ${seeds.length} failed ${failed} articleLinks ${found.size} unknown ${unknown.length}`
);
if (unknown.length) console.log(unknown.join("\n"));
