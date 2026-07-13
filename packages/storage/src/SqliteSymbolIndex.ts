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
    // Implemented in Task 5.
    return [];
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
