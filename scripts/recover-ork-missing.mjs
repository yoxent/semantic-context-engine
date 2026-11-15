#!/usr/bin/env node
/**
 * Fill ORK documentation holes.
 *
 * Pages that 404 are checked on the Wayback Machine. The old scripting
 * class URLs under /api/*.html 404 and were never archived; the same
 * classes are read from the live ORK 4 API instead.
 *
 * Also stores ORK 3 system pages that have no ORK 4 counterpart.
 *
 * Usage: node scripts/recover-ork-missing.mjs
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const topicDir = join(root, "knowledge", "ork-framework");
const urlFile = join(root, "knowledge", "urls", "ork-framework.txt");
const ua = "Mozilla/5.0 (compatible; SCE-Scraper/1.0)";
const api4 = "https://orkframework.com/resources/api/api_ork_4/";

const proseUrls = [
  "https://orkframework.com/guide/ork3/ork3-documentation/scripting/scripting-overview/",
  "https://orkframework.com/guide/ork3/ork3-documentation/scripting/combatant-scripting/",
  "https://orkframework.com/guide/ork3/ork3-documentation/scripting/code-extensions/",
  "https://orkframework.com/guide/ork3/ork3-documentation/scripting/custom-targeting/",
  "https://orkframework.com/guide/ork3/ork3-documentation/features/formula-nodes/",
  "https://orkframework.com/guide/ork3/ork3-documentation/features/combatant-triggers/",
  "https://orkframework.com/guide/ork3/ork3-documentation/battles/battle-ai-nodes/",
  "https://orkframework.com/guide/ork3/ork3-documentation/battles/calculating-action-results/",
  "https://orkframework.com/guide/ork3/ork3-documentation/battles/grid-battles/",
  "https://orkframework.com/guide/ork3/ork3-documentation/battles/battle-end/",
  "https://orkframework.com/guide/ork3/ork3-documentation/battles/adding-battles-to-scenes/",
  "https://orkframework.com/guide/ork3/ork3-documentation/battles/adding-battle-grids-to-scenes/",
  "https://orkframework.com/guide/ork3/ork3-documentation/status/status-conditions/",
  "https://orkframework.com/guide/ork3/ork3-documentation/getting-started/game-over/",
  "https://orkframework.com/guide/ork3/ork3-documentation/inventory/inventory-system-overview/",
  "https://orkframework.com/guide/ork3/ork3-documentation/inventory/ai-behaviours-rulesets/",
  "https://orkframework.com/guide/ork3/ork3-documentation/ui-system/ui-system-overview/",
  "https://orkframework.com/guide/ork3/ork3-documentation/ui-system/timebar-hud/",
];

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
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function stripTags(html) {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function htmlToMarkdown(html) {
  let src = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a\b[^>]*batterdocs-anchor[^>]*>[\s\S]*?<\/a>/gi, "");
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
  src = src.replace(/<\/?(strong|b)\b[^>]*>/gi, "**");
  src = src.replace(/<(strong|b)\b[^>]*>/gi, "**");
  src = src.replace(/<\/?(em|i)\b[^>]*>/gi, "*");
  src = src.replace(/<(em|i)\b[^>]*>/gi, "*");
  src = src.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_, inner) => stripTags(inner));
  src = src.replace(/<[^>]+>/g, "");
  src = decode(src).replace(/\u00a0/g, " ");
  src = src.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/\*{4,}/g, "**");
  return src.trim();
}

function extractArticle(html) {
  const start = html.indexOf('id="betterdocs-single-content"');
  if (start < 0) return "";
  const openEnd = html.indexOf(">", start);
  let end = -1;
  for (const marker of ['id="betterdocs-sidebar-right"', "betterdocs-article-reactions"]) {
    const at = html.indexOf(marker, openEnd);
    if (at > openEnd && (end < 0 || at < end)) end = at;
  }
  return htmlToMarkdown(html.slice(openEnd + 1, end > openEnd ? end : openEnd + 80000));
}

async function fetchResponse(url, attempt = 1) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": ua }, redirect: "follow" });
    return response;
  } catch (error) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return fetchResponse(url, attempt + 1);
    }
    throw error;
  }
}

async function wayback(url) {
  const available = await fetchResponse(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
  );
  const data = await available.json().catch(() => null);
  const snap = data?.archived_snapshots?.closest;
  if (!snap?.available || !snap.timestamp) return null;
  const rawUrl = `https://web.archive.org/web/${snap.timestamp}id_/${url}`;
  const page = await fetchResponse(rawUrl);
  if (!page.ok) return null;
  return { timestamp: snap.timestamp, rawUrl, text: await page.text(), type: page.headers.get("content-type") || "" };
}

function proseFilename(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const section = (parts[3] || "general").replace(/^ork3-/, "");
  const slug = parts[4] || "index";
  const name = `ork3-${section}-${slug}`.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80);
  return `${name}.md`;
}

function markdownFromBody(text, url) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n+/, "").trim();
  const title = (body.match(/^#\s+(.+)$/m) || [])[1] || proseFilename(url);
  const rest = body.replace(/^#\s+.+\n+/, "");
  return { title, markdown: `# ${title}\n\nSource: ${url}\n\n${rest}\n` };
}

function classCard(html, fetchedUrl, deadUrl, archiveNote) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const fullTitle = titleMatch ? decode(titleMatch[1]) : "ORK class";
  const className = fullTitle
    .replace(/^ORK.*?Framework:\s*/i, "")
    .replace(/\s+Class Reference.*$/i, "")
    .trim();
  const blocks = [...html.matchAll(/<div class="textblock">([\s\S]*?)<\/div>/gi)].map((match) =>
    stripTags(match[1])
  );
  const brief = blocks.filter((block) => block.length > 40).slice(0, 2).join("\n\n");
  const names = [];
  const seen = new Set();
  for (const match of html.matchAll(/<td class="memItemRight"[^>]*>[\s\S]*?<a class="el"[^>]*>([^<]+)<\/a>/gi)) {
    const name = decode(match[1]).trim();
    if (!name || seen.has(name) || name.length > 80) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= 40) break;
  }
  const slug = className.split(".").pop().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const lines = [
    `# ${className || slug}`,
    "",
    `Source: ${fetchedUrl}`,
    "",
    archiveNote,
    "",
    brief || "No class description was present on the API page.",
    "",
  ];
  if (names.length) {
    lines.push("## Members", "");
    for (const name of names) lines.push(`- ${name}`);
    lines.push("");
  }
  return { filename: `ork4-api-${slug || "class"}.md`, markdown: `${lines.join("\n")}\n` };
}

const proseSeeds = proseUrls;
const recovered = [];
const apiLinks = new Set();

mkdirSync(topicDir, { recursive: true });

for (const url of proseSeeds) {
  const response = await fetchResponse(url);
  const type = response.headers.get("content-type") || "";
  let markdown;
  let title;
  let sourceNote = url;
  if (!response.ok) {
    const archived = await wayback(url);
    if (!archived) {
      console.log(`MISSING ${response.status} no-archive ${url}`);
      continue;
    }
    sourceNote = `${url} (live ${response.status}; Wayback ${archived.timestamp})`;
    if (archived.type.includes("markdown") || archived.text.startsWith("---") || archived.text.startsWith("#")) {
      ({ title, markdown } = markdownFromBody(archived.text, sourceNote));
    } else {
      title = "Recovered";
      const body = extractArticle(archived.text) || htmlToMarkdown(archived.text).slice(0, 20000);
      markdown = `# ${title}\n\nSource: ${sourceNote}\n\n${body}\n`;
    }
    console.log(`WAYBACK ${url}`);
  } else if (type.includes("markdown")) {
    ({ title, markdown } = markdownFromBody(await response.text(), url));
  } else {
    const html = await response.text();
    title = (html.match(/<title>([^<]+)/) || [])[1] || url;
    const body = extractArticle(html);
    if (body.length < 80) {
      const archived = await wayback(url);
      if (!archived) {
        console.log(`THIN no-archive ${url}`);
        continue;
      }
      const recoveredBody = archived.type.includes("markdown")
        ? markdownFromBody(archived.text, url).markdown
        : `# ${stripTags(title)}\n\nSource: ${url}\n\nLive page had no article. Wayback ${archived.timestamp}.\n\n${extractArticle(archived.text) || htmlToMarkdown(archived.text).slice(0, 20000)}\n`;
      markdown = recoveredBody;
      console.log(`WAYBACK-THIN ${url}`);
    } else {
      markdown = `# ${stripTags(title).replace(/\s+[-|]\s+ORK.*$/i, "")}\n\nSource: ${url}\n\n${body}\n`;
    }
  }
  for (const match of markdown.matchAll(/https?:\/\/orkframework\.com\/api\/(class_[a-z0-9_]+\.html)/gi)) {
    apiLinks.add(match[1]);
  }
  const filename = proseFilename(url);
  writeFileSync(join(topicDir, filename), markdown);
  recovered.push(filename);
  console.log(`PROSE ${filename} ${markdown.length}`);
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`API links ${apiLinks.size}`);
let archivedClasses = 0;
let movedClasses = 0;
for (const file of apiLinks) {
  const deadUrl = `https://orkframework.com/api/${file}`;
  const liveUrl = `${api4}${file}`;
  const archived = await wayback(deadUrl);
  let html = "";
  let fetchedUrl = liveUrl;
  let note = "";
  if (archived && archived.text.length > 500) {
    html = archived.text;
    fetchedUrl = archived.rawUrl;
    note = `The documentation link ${deadUrl} returns 404. This text is the Wayback Machine capture ${archived.timestamp}.`;
    archivedClasses += 1;
  } else {
    const live = await fetchResponse(liveUrl);
    if (!live.ok) {
      console.log(`CLASS-MISSING ${deadUrl} live ${live.status} archive none`);
      continue;
    }
    html = await live.text();
    note = `The documentation link ${deadUrl} returns 404. The Internet Archive has no capture of that URL. This is the same class on the current ORK 4 API.`;
    movedClasses += 1;
  }
  const card = classCard(html, fetchedUrl, deadUrl, note);
  writeFileSync(join(topicDir, card.filename), card.markdown);
  recovered.push(card.filename);
  console.log(`CLASS ${card.filename} ${card.markdown.length} ${archived ? "archive" : "live-api"}`);
  await new Promise((r) => setTimeout(r, 120));
}

appendFileSync(
  urlFile,
  `\n# Recovered after 404 / missing-article checks. Wayback used when a capture exists.\n${proseUrls.join("\n")}\n`
);
console.log(`DONE files ${recovered.length} wayback-classes ${archivedClasses} moved-classes ${movedClasses}`);
