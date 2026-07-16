#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Configuration
const API_BASE = process.env.SCE_API_URL || "https://sce-api.pasttime.xyz";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Search schema
const SearchSchema = z.object({
  query: z.string().describe("Search query (keywords or natural language)"),
  mode: z
    .enum(["keyword", "semantic", "hybrid"])
    .default("hybrid")
    .describe("Search mode: keyword (fast), semantic (meaning), hybrid (best)"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of results"),
});

const GetChunkSchema = z.object({
  chunkId: z.string().describe("The chunk ID to retrieve"),
});

const ListSourcesSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
});

// Embed text using OpenRouter (for local semantic search)
async function embedText(text: string): Promise<number[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Create MCP server
const server = new Server(
  {
    name: "sce-search",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_knowledge",
        description:
          "Search the Semantic Context Engine knowledgebase. Use this to find relevant code, documentation, patterns, and context from indexed projects and documentation.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search query - can be keywords or natural language question",
            },
            mode: {
              type: "string",
              enum: ["keyword", "semantic", "hybrid"],
              default: "hybrid",
              description:
                "Search mode: keyword (fast, exact matches), semantic (understands meaning), hybrid (combines both)",
            },
            limit: {
              type: "number",
              default: 10,
              description: "Maximum number of results to return",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_document",
        description:
          "Retrieve the full content of a specific document/chunk by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            chunkId: {
              type: "string",
              description: "The chunk ID to retrieve",
            },
          },
          required: ["chunkId"],
        },
      },
      {
        name: "list_sources",
        description:
          "List all indexed sources/files in the knowledgebase.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              default: 20,
              description: "Maximum number of sources to list",
            },
          },
        },
      },
      {
        name: "get_stats",
        description:
          "Get statistics about the knowledgebase (chunk count, vector count, etc).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_knowledge": {
        const { query, mode, limit } = SearchSchema.parse(args);

        const params = new URLSearchParams({
          q: query,
          mode: mode || "hybrid",
          limit: String(limit || 10),
        });

        const response = await fetch(`${API_BASE}/api/search?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || "Search failed");
        }

        // Format results for AI consumption
        const formatted = data.hits.map(
          (hit: any, i: number) =>
            `[${i + 1}] ${hit.relativePath}${
              hit.headingPath ? ` > ${hit.headingPath}` : ""
            }\nScore: ${hit.score.toFixed(3)} | Language: ${
              hit.language || "unknown"
            }\n${hit.text.substring(0, 500)}${
              hit.text.length > 500 ? "..." : ""
            }`
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${data.totalHits} results in ${data.searchTimeMs}ms:\n\n${formatted.join(
                "\n\n"
              )}`,
            },
          ],
        };
      }

      case "get_document": {
        const { chunkId } = GetChunkSchema.parse(args);

        const response = await fetch(`${API_BASE}/api/chunk/${chunkId}`);
        const chunk = await response.json();

        if (!response.ok) {
          throw new Error(chunk.error || "Failed to get document");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Source: ${chunk.relativePath}\nHeading: ${
                chunk.headingPath || "N/A"
              }\nLanguage: ${chunk.language || "unknown"}\n\n${
                chunk.text
              }`,
            },
          ],
        };
      }

      case "list_sources": {
        const { limit } = ListSourcesSchema.parse(args || {});

        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();

        return {
          content: [
            {
              type: "text" as const,
              text: `Knowledgebase contains ${stats.chunks} chunks with ${stats.vectors} vectors.\nEmbedding model: ${stats.embeddingModel}`,
            },
          ],
        };
      }

      case "get_stats": {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SCE MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
