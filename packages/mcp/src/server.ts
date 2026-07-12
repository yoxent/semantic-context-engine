import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sceGetChunk, sceIndexRepository, sceSearch, sceStats, sceUpdateRepository } from "./tools.js";

const server = new McpServer({ name: "semantic-context-engine", version: "0.0.0" });

server.tool("sce_index_repository", { path: z.string(), type: z.enum(["code", "vault"]).optional() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceIndexRepository(input), null, 2) }]
}));

server.tool("sce_update_repository", { path: z.string(), type: z.enum(["code", "vault"]).optional() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceUpdateRepository(input), null, 2) }]
}));

server.tool(
  "sce_search",
  {
    path: z.string(),
    query: z.string(),
    limit: z.number().optional(),
    includeText: z.boolean().optional(),
    pathFilter: z.string().optional(),
    language: z.string().optional(),
    repositoryIds: z.array(z.string()).optional()
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await sceSearch(input), null, 2) }]
  })
);

server.tool(
  "sce_get_chunk",
  { path: z.string(), chunkId: z.string(), maxChars: z.number().optional() },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await sceGetChunk(input), null, 2) }]
  })
);

server.tool("sce_stats", { path: z.string() }, async (input) => ({
  content: [{ type: "text", text: JSON.stringify(await sceStats(input), null, 2) }]
}));

await server.connect(new StdioServerTransport());
