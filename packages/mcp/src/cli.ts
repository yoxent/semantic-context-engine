#!/usr/bin/env node

// SCE Search CLI - for use with Pi and other agents

const API_BASE = process.env.SCE_API_URL || "https://sce-api.pasttime.xyz";

async function search(query: string, mode: string = "hybrid", limit: number = 10) {
  const params = new URLSearchParams({
    q: query,
    mode,
    limit: String(limit),
  });

  const response = await fetch(`${API_BASE}/api/search?${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || "Search failed");
  }

  console.log(`\nFound ${data.totalHits} results in ${data.searchTimeMs}ms:\n`);
  
  data.hits.forEach((hit: any, i: number) => {
    console.log(`[${i + 1}] ${hit.relativePath}${hit.headingPath ? ` > ${hit.headingPath}` : ""}`);
    console.log(`    Score: ${hit.score.toFixed(3)} | Language: ${hit.language || "unknown"}`);
    console.log(`    ${hit.text.substring(0, 300)}${hit.text.length > 300 ? "..." : ""}`);
    console.log();
  });
}

async function stats() {
  const response = await fetch(`${API_BASE}/api/stats`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "search":
    case "s":
      if (!args[1]) {
        console.error("Usage: sce search <query> [mode] [limit]");
        process.exit(1);
      }
      await search(args[1], args[2] || "hybrid", parseInt(args[3] || "10"));
      break;

    case "stats":
      await stats();
      break;

    default:
      console.log(`SCE Search CLI

Usage:
  sce search <query> [mode] [limit]   Search the knowledgebase
  sce stats                           Show database statistics

Modes:
  keyword   - Fast, exact matches (default: hybrid)
  semantic  - Understands meaning
  hybrid    - Combines both

Examples:
  sce search "D1 transactions"
  sce search "how to use KV" semantic 5
  sce stats`);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
