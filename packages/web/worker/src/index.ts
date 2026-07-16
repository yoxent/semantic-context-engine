/**
 * Cloudflare Worker entry point.
 *
 * Routes:
 *   GET /api/search?q=...&mode=keyword|semantic|hybrid|ast
 *   GET /api/stats
 *
 * Handles CORS for cross-origin frontend access.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { search, type SearchMode } from "./search";

// ---------------------------------------------------------------------------
// Environment (bindings)
// ---------------------------------------------------------------------------

export interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  ENVIRONMENT?: string;
}

// ---------------------------------------------------------------------------
// Query-string parsing
// ---------------------------------------------------------------------------

interface SearchParams {
  q: string;
  mode: string;
  limit: string;
  repositoryIds?: string;
  pathFilter?: string;
  language?: string;
  symbolKind?: string;
}

function parseSearchParams(url: URL): SearchParams {
  return {
    q: url.searchParams.get("q") ?? "",
    mode: url.searchParams.get("mode") ?? "keyword",
    limit: url.searchParams.get("limit") ?? "20",
    repositoryIds: url.searchParams.get("repositoryIds") ?? undefined,
    pathFilter: url.searchParams.get("pathFilter") ?? undefined,
    language: url.searchParams.get("language") ?? undefined,
    symbolKind: url.searchParams.get("symbolKind") ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(
  data: unknown,
  status: number,
  origin: string | null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const VALID_MODES: SearchMode[] = ["keyword", "semantic", "hybrid", "ast"];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // ---- CORS preflight ----
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // ---- /api/search ----
    if (url.pathname === "/api/search") {
      const params = parseSearchParams(url);

      if (!params.q) {
        return jsonResponse(
          { error: 'Query parameter "q" is required' },
          400,
          origin
        );
      }

      const mode = (params.mode || "keyword") as SearchMode;
      if (!VALID_MODES.includes(mode)) {
        return jsonResponse(
          { error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` },
          400,
          origin
        );
      }

      const filters = {
        repositoryIds: params.repositoryIds
          ? params.repositoryIds.split(",")
          : undefined,
        pathFilter: params.pathFilter,
        language: params.language,
        symbolKind: params.symbolKind,
      };

      try {
        const result = await search(
          env.DB,
          env,
          params.q,
          mode,
          parseInt(params.limit || "20", 10),
          filters
        );
        return jsonResponse(result, 200, origin);
      } catch (error) {
        console.error("Search error:", error);
        return jsonResponse(
          {
            error: "Search failed",
            message: (error as Error).message,
          },
          500,
          origin
        );
      }
    }

    // ---- /api/chunk/:id ----
    const chunkMatch = url.pathname.match(/^\/api\/chunk\/([^/]+)$/);
    if (chunkMatch && request.method === "GET") {
      const chunkId = chunkMatch[1];
      try {
        const chunk = await env.DB.prepare(
          "SELECT id, repository_id, relative_path, heading_path, language, text FROM chunks WHERE id = ?"
        ).bind(chunkId).first();

        if (!chunk) {
          return jsonResponse({ error: "Chunk not found" }, 404, origin);
        }

        return jsonResponse(
          {
            id: chunk.id,
            relativePath: chunk.relative_path,
            headingPath: chunk.heading_path,
            language: chunk.language,
            text: chunk.text,
          },
          200,
          origin
        );
      } catch (error) {
        console.error("Chunk fetch error:", error);
        return jsonResponse({ error: "Failed to fetch chunk" }, 500, origin);
      }
    }

    // ---- /api/stats ----
    if (url.pathname === "/api/stats") {
      try {
        const [chunkRow, vectorRow, symbolRow, modelRow] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS count FROM chunks").first(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM vectors").first(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM symbols").first(),
          env.DB.prepare(
            "SELECT value FROM embedding_config WHERE key = 'model'"
          ).first(),
        ]);

        return jsonResponse(
          {
            chunks: chunkRow?.count ?? 0,
            vectors: vectorRow?.count ?? 0,
            symbols: symbolRow?.count ?? 0,
            embeddingModel: modelRow?.value ?? "unknown",
          },
          200,
          origin
        );
      } catch (error) {
        console.error("Stats error:", error);
        return jsonResponse({ error: "Failed to fetch stats" }, 500, origin);
      }
    }

    // ---- 404 ----
    return new Response("Not Found", { status: 404 });
  },
};
