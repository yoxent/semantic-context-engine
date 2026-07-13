import Database from "better-sqlite3";
import type { IVectorStore, ModelDimensions, VectorSearchHit, VectorSearchQuery, VectorUpsert } from "@sce/core";

export class SqliteVectorStore implements IVectorStore {
  constructor(private readonly db: Database.Database) {}

  static attach(db: Database.Database): SqliteVectorStore {
    return new SqliteVectorStore(db);
  }

  async upsert(entry: VectorUpsert): Promise<void> {
    if (entry.vector.length !== entry.dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${entry.dimensions}, got ${entry.vector.length} (chunk ${entry.chunkId})`
      );
    }
    this.db
      .prepare(
        `INSERT OR REPLACE INTO vectors (repository_id, chunk_id, relative_path, model, dimensions, vector, updated_at)
         VALUES (@repositoryId, @chunkId, @relativePath, @model, @dimensions, @vector, @updatedAt)`
      )
      .run({
        repositoryId: entry.repositoryId,
        chunkId: entry.chunkId,
        relativePath: entry.relativePath,
        model: entry.model,
        dimensions: entry.dimensions,
        vector: JSON.stringify(entry.vector),
        updatedAt: new Date().toISOString()
      });
  }

  async search(query: VectorSearchQuery): Promise<VectorSearchHit[]> {
    return cosineSearch(this.db, query);
  }

  async deleteByChunk(chunkId: string): Promise<void> {
    this.db.prepare("DELETE FROM vectors WHERE chunk_id = ?").run(chunkId);
  }

  async deleteByRepository(repositoryId: string): Promise<void> {
    this.db.prepare("DELETE FROM vectors WHERE repository_id = ?").run(repositoryId);
  }

  async deleteByFile(repositoryId: string, relativePath: string): Promise<void> {
    this.db.prepare("DELETE FROM vectors WHERE repository_id = ? AND relative_path = ?").run(repositoryId, relativePath);
  }

  async getModelDimensions(repositoryId: string): Promise<ModelDimensions | undefined> {
    const row = this.db
      .prepare("SELECT model, dimensions FROM vectors WHERE repository_id = ? LIMIT 1")
      .get(repositoryId) as { model: string; dimensions: number } | undefined;
    if (!row) return undefined;
    return { model: row.model, dimensions: row.dimensions };
  }
}

function cosineSearch(db: Database.Database, query: VectorSearchQuery): VectorSearchHit[] {
  if (query.vector.length !== query.dimensions) {
    throw new Error(
      `Embedding dimension mismatch: expected ${query.dimensions}, got ${query.vector.length} (query vector)`
    );
  }
  const repositoryClause =
    query.repositoryIds && query.repositoryIds.length > 0
      ? `AND repository_id IN (${query.repositoryIds.map(() => "?").join(", ")})`
      : "";
  const params: unknown[] = [...(query.repositoryIds ?? [])];
  const rows = db
    .prepare(`SELECT chunk_id, vector, model, dimensions FROM vectors WHERE 1=1 ${repositoryClause}`)
    .all(...params) as { chunk_id: string; vector: string; model: string; dimensions: number }[];

  const queryNorm = norm(query.vector);
  if (queryNorm === 0) return [];

  const scored = rows
    .filter((row) => row.model === query.model && row.dimensions === query.dimensions)
    .map((row) => {
      const candidate = JSON.parse(row.vector) as number[];
      if (candidate.length !== query.dimensions) return null;
      const dot = dotProduct(query.vector, candidate);
      const candidateNorm = norm(candidate);
      if (candidateNorm === 0) return null;
      return { chunkId: row.chunk_id, score: dot / (queryNorm * candidateNorm) };
    })
    .filter((hit): hit is VectorSearchHit => hit !== null);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, query.limit);
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

function norm(a: number[]): number {
  return Math.sqrt(dotProduct(a, a));
}