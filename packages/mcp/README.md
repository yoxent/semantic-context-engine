# SCE MCP Server

Model Context Protocol server for Semantic Context Engine.

## What It Does

Exposes SCE search capabilities as MCP tools that AI coding agents can use:

- **search_knowledge** - Search indexed documentation and code
- **get_document** - Retrieve full content of a specific chunk
- **list_sources** - List what's in the knowledgebase
- **get_stats** - Get knowledgebase statistics

## Setup

### 1. Build

```bash
cd packages/mcp
npm install
npm run build
```

### 2. Configure Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "sce": {
      "command": "node",
      "args": ["E:/Projects/Indie/semantic-context-engine/packages/mcp/dist/index.js"],
      "env": {
        "SCE_API_URL": "https://sce-api.pasttime.xyz",
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

### 3. Use It

In Claude Code, you can now ask:

> "Search the knowledgebase for D1 transaction patterns"

Claude will automatically use the MCP tool to search your indexed documentation.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCE_API_URL` | `https://sce-api.pasttime.xyz` | SCE API endpoint |
| `OPENROUTER_API_KEY` | (required for semantic) | OpenRouter API key (see `packages/web/.dev.vars`) |

## Tools

### search_knowledge
```json
{
  "query": "how to use D1 batch inserts",
  "mode": "hybrid",
  "limit": 10
}
```

### get_document
```json
{
  "chunkId": "abc123..."
}
```

### list_sources
```json
{
  "limit": 20
}
```

### get_stats
```json
{}
```
