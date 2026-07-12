import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import Database, { SqliteError } from "better-sqlite3";
import type { Chunk, FileRecord, IKeywordIndex, IMetadataStore, Repository, SearchHit, SearchQuery, EngineStatistics } from "@sce/core";
import { createSchemaSql } from "./schema.js";

export class SqliteStorage implements IMetadataStore, IKeywordIndex {
  private constructor(private readonly db: Database.Database) {}

  static async open(rootPath: string): Promise<SqliteStorage> {
    const sceDir = join(rootPath, ".sce");
    await mkdir(sceDir, { recursive: true });
    const db = new Database(join(sceDir, "metadata.sqlite"));
    db.exec(createSchemaSql);
    return new SqliteStorage(db);
  }

  close(): void {
    this.db.close();
  }

  async saveRepository(repository: Repository): Promise<void> {
    this.db.prepare(
      `INSERT OR REPLACE INTO repositories (id, root_path, type, indexed_at, display_name)
       VALUES (@id, @rootPath, @type, @indexedAt, @displayName)`
    ).run({ ...repository, indexedAt: repository.indexedAt.toISOString(), displayName: repository.displayName ?? null });
  }

  async getRepository(id: string): Promise<Repository | undefined> {
    const row = this.db.prepare("SELECT * FROM repositories WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      rootPath: row.root_path,
      type: row.type,
      indexedAt: new Date(row.indexed_at),
      displayName: row.display_name ?? undefined
    };
  }

  async deleteRepository(id: string): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db.prepare(
        "DELETE FROM chunk_links WHERE source_chunk_id IN (SELECT id FROM chunks WHERE repository_id = ?)"
      ).run(id);
      this.db.prepare("DELETE FROM repositories WHERE id = ?").run(id);
      this.db.prepare("DELETE FROM files WHERE repository_id = ?").run(id);
      this.db.prepare("DELETE FROM chunks WHERE repository_id = ?").run(id);
      this.db.prepare("DELETE FROM chunks_fts WHERE repository_id = ?").run(id);
    });
    tx();
  }

  async saveFile(record: FileRecord): Promise<void> {
    this.db.prepare(
      `INSERT OR REPLACE INTO files (repository_id, relative_path, language, file_hash, indexed_at)
       VALUES (@repositoryId, @relativePath, @language, @fileHash, @indexedAt)`
    ).run({ ...record, indexedAt: record.indexedAt.toISOString() });
  }

  async getFile(repositoryId: string, relativePath: string): Promise<FileRecord | undefined> {
    const row = this.db.prepare("SELECT * FROM files WHERE repository_id = ? AND relative_path = ?").get(repositoryId, relativePath) as any;
    if (!row) return undefined;
    return {
      repositoryId: row.repository_id,
      relativePath: row.relative_path,
      language: row.language,
      fileHash: row.file_hash,
      indexedAt: new Date(row.indexed_at)
    };
  }

  async listFiles(repositoryId: string): Promise<FileRecord[]> {
    const rows = this.db.prepare("SELECT * FROM files WHERE repository_id = ?").all(repositoryId) as any[];
    return rows.map((row) => ({
      repositoryId: row.repository_id,
      relativePath: row.relative_path,
      language: row.language,
      fileHash: row.file_hash,
      indexedAt: new Date(row.indexed_at)
    }));
  }

  async deleteFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db.prepare("DELETE FROM files WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
  }

  async saveChunks(chunks: Chunk[]): Promise<void> {
    const insertChunk = this.db.prepare(
      `INSERT OR REPLACE INTO chunks
       (id, repository_id, relative_path, language, start_line, end_line, text, file_hash, timestamp, heading_path_json, wiki_links_json)
       VALUES (@id, @repositoryId, @relativePath, @language, @startLine, @endLine, @text, @fileHash, @timestamp, @headingPathJson, @wikiLinksJson)`
    );
    const deleteLinks = this.db.prepare("DELETE FROM chunk_links WHERE source_chunk_id = ?");
    const insertLink = this.db.prepare("INSERT OR IGNORE INTO chunk_links (source_chunk_id, target) VALUES (?, ?)");
    const tx = this.db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        insertChunk.run(toChunkRow(chunk));
        deleteLinks.run(chunk.id);
        for (const link of chunk.wikiLinks ?? []) insertLink.run(chunk.id, link);
      }
    });
    tx(chunks);
  }

  async getChunk(id: string): Promise<Chunk | undefined> {
    const row = this.db.prepare("SELECT * FROM chunks WHERE id = ?").get(id) as any;
    return row ? fromChunkRow(row) : undefined;
  }

  async deleteChunksForFile(repositoryId: string, relativePath: string): Promise<void> {
    const rows = this.db.prepare("SELECT id FROM chunks WHERE repository_id = ? AND relative_path = ?").all(repositoryId, relativePath) as { id: string }[];
    const tx = this.db.transaction(() => {
      for (const row of rows) this.db.prepare("DELETE FROM chunk_links WHERE source_chunk_id = ?").run(row.id);
      this.db.prepare("DELETE FROM chunks WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
    });
    tx();
  }

  async indexChunks(chunks: Chunk[]): Promise<void> {
    const removeFts = this.db.prepare("DELETE FROM chunks_fts WHERE chunk_id = ?");
    const insert = this.db.prepare(
      `INSERT INTO chunks_fts (chunk_id, repository_id, relative_path, heading_path, text)
       VALUES (@id, @repositoryId, @relativePath, @headingPath, @text)`
    );
    const tx = this.db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        removeFts.run(chunk.id);
        insert.run({ ...chunk, headingPath: (chunk.headingPath ?? []).join(" / ") });
      }
    });
    tx(chunks);
  }

  async removeChunksForFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db.prepare("DELETE FROM chunks_fts WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
  }

  async getStatistics(): Promise<EngineStatistics> {
    const repos = this.db.prepare("SELECT id, root_path, type, indexed_at FROM repositories ORDER BY indexed_at DESC").all() as Array<{
      id: string;
      root_path: string;
      type: string;
      indexed_at: string;
    }>;

    const repositories = repos.map((repo) => {
      const fileCount = (
        this.db.prepare("SELECT COUNT(*) AS count FROM files WHERE repository_id = ?").get(repo.id) as { count: number }
      ).count;
      const chunkCount = (
        this.db.prepare("SELECT COUNT(*) AS count FROM chunks WHERE repository_id = ?").get(repo.id) as { count: number }
      ).count;
      return {
        id: repo.id,
        rootPath: repo.root_path,
        type: repo.type,
        indexedAt: repo.indexed_at,
        fileCount,
        chunkCount
      };
    });

    const fileCount = (this.db.prepare("SELECT COUNT(*) AS count FROM files").get() as { count: number }).count;
    const chunkCount = (this.db.prepare("SELECT COUNT(*) AS count FROM chunks").get() as { count: number }).count;
    const linkCount = (this.db.prepare("SELECT COUNT(*) AS count FROM chunk_links").get() as { count: number }).count;

    return {
      repositoryCount: repositories.length,
      fileCount,
      chunkCount,
      linkCount,
      lastIndexedAt: repositories[0]?.indexedAt,
      repositories
    };
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const limit = query.limit ?? 10;
    const ftsQuery = buildFtsQuery(query.text);
    if (!ftsQuery) return [];

    const where: string[] = ["chunks_fts MATCH ?"];
    const params: unknown[] = [ftsQuery];

    if (query.repositoryIds && query.repositoryIds.length > 0) {
      where.push(`chunks_fts.repository_id IN (${query.repositoryIds.map(() => "?").join(", ")})`);
      params.push(...query.repositoryIds);
    }

    const pathClause = buildPathFilterClause(query.pathFilter);
    if (pathClause) {
      where.push(pathClause.sql);
      params.push(...pathClause.params);
    }

    const needsJoin = Boolean(query.language);
    if (query.language) {
      where.push("chunks.language = ?");
      params.push(query.language);
    }

    params.push(limit);

    const from = needsJoin
      ? "chunks_fts INNER JOIN chunks ON chunks.id = chunks_fts.chunk_id"
      : "chunks_fts";

    try {
      const rows = this.db.prepare(
        `SELECT chunks_fts.chunk_id AS chunk_id,
                chunks_fts.relative_path AS relative_path,
                snippet(chunks_fts, 4, '', '', ' ... ', 16) AS snippet,
                bm25(chunks_fts) AS rank
         FROM ${from}
         WHERE ${where.join(" AND ")}
         ORDER BY rank
         LIMIT ?`
      ).all(...params) as any[];

      return rows.map((row) => {
        const chunk = this.db
          .prepare("SELECT start_line, end_line, heading_path_json FROM chunks WHERE id = ?")
          .get(row.chunk_id) as { start_line: number; end_line: number; heading_path_json: string } | undefined;
        const headingPath = parseHeadingPath(chunk?.heading_path_json);
        return {
          chunkId: row.chunk_id,
          score: Math.abs(Number(row.rank)),
          strategy: "keyword" as const,
          snippet: row.snippet,
          path: row.relative_path,
          startLine: chunk?.start_line ?? 1,
          endLine: chunk?.end_line ?? 1,
          ...(headingPath ? { headingPath } : {})
        };
      });
    } catch (err) {
      if (err instanceof SqliteError) return [];
      throw err;
    }
  }
}

function buildPathFilterClause(pathFilter?: string): { sql: string; params: unknown[] } | undefined {
  if (!pathFilter) return undefined;
  if (/[*?]/.test(pathFilter)) {
    return { sql: "chunks_fts.relative_path GLOB ?", params: [pathFilter] };
  }
  return {
    sql: "(chunks_fts.relative_path = ? OR chunks_fts.relative_path LIKE ? ESCAPE '\\')",
    params: [pathFilter, `${escapeLike(pathFilter)}/%`]
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildFtsQuery(text: string): string | null {
  const terms = text.match(/[\p{L}\p{N}_]+/gu);
  if (!terms || terms.length === 0) return null;
  return terms.map((term) => `"${term.replace(/"/g, '""')}"`).join(" ");
}

function parseHeadingPath(json?: string): string[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    return parsed.filter((part): part is string => typeof part === "string");
  } catch {
    return undefined;
  }
}

function toChunkRow(chunk: Chunk): Record<string, unknown> {
  return {
    id: chunk.id,
    repositoryId: chunk.repositoryId,
    relativePath: chunk.relativePath,
    language: chunk.language,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    text: chunk.text,
    fileHash: chunk.fileHash,
    timestamp: chunk.timestamp.toISOString(),
    headingPathJson: JSON.stringify(chunk.headingPath ?? []),
    wikiLinksJson: JSON.stringify(chunk.wikiLinks ?? [])
  };
}

function fromChunkRow(row: any): Chunk {
  return {
    id: row.id,
    repositoryId: row.repository_id,
    relativePath: row.relative_path,
    language: row.language,
    startLine: row.start_line,
    endLine: row.end_line,
    text: row.text,
    fileHash: row.file_hash,
    timestamp: new Date(row.timestamp),
    headingPath: JSON.parse(row.heading_path_json),
    wikiLinks: JSON.parse(row.wiki_links_json)
  };
}
