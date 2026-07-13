import type { Database } from "better-sqlite3";
import type { Chunk, ISymbolIndex, SymbolHit, SymbolSearchQuery } from "@sce/core";
import { buildPathFilterClause } from "./pathFilter.js";

export class SqliteSymbolIndex implements ISymbolIndex {
  constructor(private readonly db: Database.Database) {}

  static attach(db: Database.Database): SqliteSymbolIndex {
    return new SqliteSymbolIndex(db);
  }

  async indexSymbols(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const insert = this.db.prepare(
      `INSERT INTO symbols (chunk_id, repository_id, relative_path, language, symbol_kind, name, qualified_name)
       VALUES (@chunkId, @repositoryId, @relativePath, @language, @symbolKind, @name, @qualifiedName)`
    );
    const tx = this.db.transaction((rows: Row[]) => {
      for (const row of rows) insert.run(row);
    });
    const rows: Row[] = chunks
      .filter((c) => c.symbolKind !== undefined)
      .map((c) => ({
        chunkId: c.id,
        repositoryId: c.repositoryId,
        relativePath: c.relativePath,
        language: c.language,
        symbolKind: c.symbolKind!,
        name: c.headingPath?.at(-1) ?? "",
        qualifiedName: (c.headingPath ?? []).join("/")
      }))
      .filter((r) => r.name.length > 0); // skip unnamed (defensive)
    if (rows.length === 0) return;
    tx(rows);
  }

  async removeSymbolsForFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db
      .prepare("DELETE FROM symbols WHERE repository_id = ? AND relative_path = ?")
      .run(repositoryId, relativePath);
  }

  async deleteByRepository(repositoryId: string): Promise<void> {
    this.db.prepare("DELETE FROM symbols WHERE repository_id = ?").run(repositoryId);
  }

  async searchSymbols(query: SymbolSearchQuery): Promise<SymbolHit[]> {
    if (!query.name || query.name.trim().length === 0) return [];
    const limit = query.limit;

    const exact = this.runTier(query, "exact", limit);
    if (exact.length > 0) return exact.slice(0, limit);
    const prefix = this.runTier(query, "prefix", limit);
    return prefix.slice(0, limit);
  }

  private runTier(query: SymbolSearchQuery, matchType: "exact" | "prefix", limit: number): SymbolHit[] {
    const where: string[] = [];
    const params: unknown[] = [];

    if (matchType === "exact") {
      where.push("name = ? COLLATE NOCASE");
      params.push(query.name);
    } else {
      where.push("name LIKE ? COLLATE NOCASE");
      params.push(`${query.name}%`);
    }

    if (query.symbolKind) {
      where.push("symbol_kind = ?");
      params.push(query.symbolKind);
    }
    if (query.language) {
      where.push("language = ?");
      params.push(query.language);
    }
    if (query.repositoryIds && query.repositoryIds.length > 0) {
      where.push(`repository_id IN (${query.repositoryIds.map(() => "?").join(", ")})`);
      params.push(...query.repositoryIds);
    }
    const pathClause = buildPathFilterClause(query.pathFilter, "symbols.relative_path");
    if (pathClause) {
      where.push(pathClause.sql);
      params.push(...pathClause.params);
    }

    const sql = `
      SELECT chunk_id, symbol_kind, name, qualified_name, relative_path
      FROM symbols
      WHERE ${where.join(" AND ")}
      ORDER BY
        length(qualified_name) ASC,
        CASE symbol_kind
          WHEN 'class' THEN 0 WHEN 'interface' THEN 0 WHEN 'type' THEN 0 WHEN 'enum' THEN 0 WHEN 'namespace' THEN 0
          WHEN 'function' THEN 1 WHEN 'arrow' THEN 1 WHEN 'function-expr' THEN 1
          WHEN 'method' THEN 2
          ELSE 3
        END,
        name ASC,
        chunk_id ASC
      LIMIT ?
    `;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as SymbolRow[];
    return rows.map((row) => ({
      chunkId: row.chunk_id,
      symbolKind: row.symbol_kind as SymbolHit["symbolKind"],
      name: row.name,
      qualifiedName: row.qualified_name,
      relativePath: row.relative_path,
      matchType
    }));
  }
}

interface Row {
  chunkId: string;
  repositoryId: string;
  relativePath: string;
  language: string;
  symbolKind: string;
  name: string;
  qualifiedName: string;
}

interface SymbolRow {
  chunk_id: string;
  symbol_kind: string;
  name: string;
  qualified_name: string;
  relative_path: string;
}
