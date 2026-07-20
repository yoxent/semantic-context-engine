import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { IMetadataStore } from "./interfaces/Storage.js";
import type { IVectorStore } from "./interfaces/VectorStore.js";
import type { ISymbolIndex } from "./interfaces/SymbolIndex.js";

export interface ExportedChunk {
  id: string;
  repositoryId: string;
  relativePath: string;
  language: string | null;
  headingPath: string | null;
  startLine: number;
  endLine: number;
  text: string;
  partIndex?: number;
  totalParts?: number;
}

export interface ExportedVector {
  chunkId: string;
  embedding: number[];
}

export interface ExportedSymbol {
  id: number;
  chunkId: string;
  name: string;
  qualifiedName: string | null;
  symbolKind: string | null;
  relativePath: string;
  repositoryId: string;
}

export interface ExportMeta {
  exportedAt: string;
  chunkCount: number;
  vectorCount: number;
  symbolCount: number;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface ExportResult {
  outputDir: string;
  chunksPath: string;
  vectorsPath: string;
  symbolsPath: string;
  metaPath: string;
  meta: ExportMeta;
}

export interface ExportContext {
  metadataStore: IMetadataStore;
  vectorStore?: IVectorStore;
  symbolIndex: ISymbolIndex;
}

export async function exportIndex(
  ctx: ExportContext,
  embeddingModel: string,
  embeddingDimensions: number,
  outputDir: string
): Promise<ExportResult> {
  await mkdir(outputDir, { recursive: true });

  // Export chunks
  const chunks = await ctx.metadataStore.getAllChunks();
  const exportedChunks: ExportedChunk[] = chunks.map((c) => ({
    id: c.id,
    repositoryId: c.repositoryId,
    relativePath: c.relativePath,
    language: c.language || null,
    headingPath: c.headingPath ? c.headingPath.join(" / ") : null,
    startLine: c.startLine,
    endLine: c.endLine,
    text: c.text,
    partIndex: c.partIndex,
    totalParts: c.totalParts,
  }));

  // Export vectors
  let exportedVectors: ExportedVector[] = [];
  if (ctx.vectorStore) {
    const vectors = await ctx.vectorStore.getAllVectors();
    exportedVectors = vectors.map((v) => ({
      chunkId: v.chunkId,
      embedding: v.vector
    }));
  }

  // Export symbols
  const symbols = await ctx.symbolIndex.getAllSymbols();
  const exportedSymbols: ExportedSymbol[] = symbols.map((s) => ({
    id: s.id,
    chunkId: s.chunkId,
    name: s.name,
    qualifiedName: s.qualifiedName || null,
    symbolKind: s.symbolKind || null,
    relativePath: s.relativePath,
    repositoryId: s.repositoryId
  }));

  const meta: ExportMeta = {
    exportedAt: new Date().toISOString(),
    chunkCount: exportedChunks.length,
    vectorCount: exportedVectors.length,
    symbolCount: exportedSymbols.length,
    embeddingModel,
    embeddingDimensions
  };

  const chunksPath = join(outputDir, "chunks.json");
  const vectorsPath = join(outputDir, "vectors.json");
  const symbolsPath = join(outputDir, "symbols.json");
  const metaPath = join(outputDir, "meta.json");

  await writeFile(chunksPath, JSON.stringify(exportedChunks, null, 2));
  await writeFile(vectorsPath, JSON.stringify(exportedVectors, null, 2));
  await writeFile(symbolsPath, JSON.stringify(exportedSymbols, null, 2));
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  return { outputDir, chunksPath, vectorsPath, symbolsPath, metaPath, meta };
}
