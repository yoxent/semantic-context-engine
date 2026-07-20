import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  Chunk,
  IChunker,
  IEmbeddingProvider,
  IKeywordIndex,
  IMetadataStore,
  ISymbolIndex,
  IVectorStore,
  Logger,
  RepositoryType,
  SceConfig
} from "@sce/core";
import { defaultConfig, detectLanguage } from "@sce/core";

/** Max characters per embedding part (~7500 chars ≈ ~2000 tokens, safe under 8192 limit) */
const MAX_CHARS_PER_PART = 7500;

/**
 * Split a chunk into embedding-safe parts if its text exceeds MAX_CHARS_PER_PART.
 * Each part gets a deterministic ID, a "→ Continue to Part N" suffix, and
 * the original chunk's metadata (heading, lines, etc.).
 */
function splitChunkForEmbedding(chunk: Chunk): Chunk[] {
  if (chunk.text.length <= MAX_CHARS_PER_PART) return [chunk];

  const parts: Chunk[] = [];
  const text = chunk.text;
  let partIndex = 0;
  let offset = 0;

  while (offset < text.length) {
    const isLast = offset + MAX_CHARS_PER_PART >= text.length;
    const end = isLast ? text.length : offset + MAX_CHARS_PER_PART;
    const partText = text.substring(offset, end);

    // Determine next part number for continuation pointer
    const totalParts = Math.ceil(text.length / MAX_CHARS_PER_PART);
    const suffix = isLast
      ? `\n\n---\n📄 *Part ${partIndex + 1} of ${totalParts} (end)*`
      : `\n\n---\n→ *Continues in Part ${partIndex + 2} of ${totalParts}*`;

    // Deterministic part ID: hash(originalId + partIndex)
    const partId = createHash("sha256")
      .update(`${chunk.id}#part${partIndex}`)
      .digest("hex");

    parts.push({
      ...chunk,
      id: partId,
      text: partText + suffix,
      startLine: chunk.startLine + Math.floor(offset / 80),
      endLine: chunk.startLine + Math.floor(end / 80),
      partIndex: partIndex,
      totalParts: totalParts,
    });

    partIndex++;
    offset = end;
  }

  return parts;
}
import { discoverFiles } from "./FileDiscovery.js";

export interface IndexRepositoryOptions {
  rootPath: string;
  type: RepositoryType;
  repositoryId?: string;
}

export interface IndexRepositoryResult {
  repositoryId: string;
  filesIndexed: number;
  chunksIndexed: number;
}

export interface IndexingServiceDeps {
  chunker: IChunker;
  metadataStore: IMetadataStore;
  keywordIndex: IKeywordIndex;
  symbolIndex?: ISymbolIndex;
  embeddingProvider?: IEmbeddingProvider;
  vectorStore?: IVectorStore;
  embeddingConfig?: { model: string; dimensions: number };
  config?: Pick<SceConfig, "indexing">;
  logger?: Logger;
}

export class IndexingService {
  constructor(private readonly deps: IndexingServiceDeps) {}

  async indexRepository(options: IndexRepositoryOptions): Promise<IndexRepositoryResult> {
    const rootPath = resolve(options.rootPath);
    const repositoryId = options.repositoryId ?? createRepositoryId(rootPath);
    const indexing = this.deps.config?.indexing ?? defaultConfig.indexing;
    const start = performance.now();

    this.deps.logger?.debug("index.start", { rootPath, repositoryId, type: options.type });

    const existingModel = this.deps.vectorStore
      ? await this.deps.vectorStore.getModelDimensions(repositoryId)
      : undefined;
    if (
      this.deps.vectorStore &&
      existingModel &&
      this.deps.embeddingConfig &&
      (existingModel.model !== this.deps.embeddingConfig.model ||
        existingModel.dimensions !== this.deps.embeddingConfig.dimensions)
    ) {
      throw new Error(
        `Embedding model/dimensions changed for repository ${repositoryId}: ` +
          `stored ${existingModel.model}/${existingModel.dimensions} vs config ` +
          `${this.deps.embeddingConfig.model}/${this.deps.embeddingConfig.dimensions}. ` +
          `Rebuild required: remove .sce/metadata.sqlite or run a fresh index.`
      );
    }

    await this.deps.metadataStore.saveRepository({
      id: repositoryId,
      rootPath,
      type: options.type,
      indexedAt: new Date()
    });

    const files = await discoverFiles({
      rootPath,
      include: indexing.include,
      ignore: indexing.ignore
    });
    this.deps.logger?.debug("index.discovered", { files: files.length });

    let chunksIndexed = 0;
    for (const relativePath of files) {
      const language = detectLanguage(relativePath);
      if (language === "text") {
        this.deps.logger?.debug("index.skipUnsupportedLanguage", { relativePath });
        // Clean up any pre-existing record so narrowing a previously-broader include doesn't leave orphans.
        await this.deps.metadataStore.deleteChunksForFile(repositoryId, relativePath);
        await this.deps.keywordIndex.removeChunksForFile(repositoryId, relativePath);
        if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, relativePath);
        const existing = await this.deps.metadataStore.getFile(repositoryId, relativePath);
        if (existing) await this.deps.metadataStore.deleteFile(repositoryId, relativePath);
        continue;
      }
      const absolutePath = join(rootPath, relativePath);
      const text = await readFile(absolutePath, "utf8");
      const fileHash = sha256(text);
      const existing = await this.deps.metadataStore.getFile(repositoryId, relativePath);
      if (existing?.fileHash === fileHash) {
        this.deps.logger?.debug("index.skipUnchanged", { relativePath });
        continue;
      }

      await this.deps.metadataStore.deleteChunksForFile(repositoryId, relativePath);
      await this.deps.keywordIndex.removeChunksForFile(repositoryId, relativePath);
      if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, relativePath);

      const rawChunks = this.deps.chunker.chunk({
        repositoryId,
        relativePath,
        language,
        fileHash,
        text
      });

      // Split oversized chunks into embedding-safe parts BEFORE saving to metadata
      // This ensures only properly-sized chunks are stored
      let finalChunks: Chunk[];
      if (this.deps.embeddingProvider) {
        finalChunks = [];
        for (const chunk of rawChunks) {
          finalChunks.push(...splitChunkForEmbedding(chunk));
        }
        const splitCount = finalChunks.length - rawChunks.length;
        if (splitCount > 0) {
          this.deps.logger?.debug("index.split", {
            relativePath,
            rawChunks: rawChunks.length,
            finalChunks: finalChunks.length,
            splitParts: splitCount
          });
        }
      } else {
        finalChunks = rawChunks;
      }

      await this.deps.metadataStore.saveFile({
        repositoryId,
        relativePath,
        language,
        fileHash,
        indexedAt: new Date()
      });
      await this.deps.metadataStore.saveChunks(finalChunks);
      await this.deps.keywordIndex.indexChunks(finalChunks);
      if (this.deps.symbolIndex) {
        await this.deps.symbolIndex.removeSymbolsForFile(repositoryId, relativePath);
        await this.deps.symbolIndex.indexSymbols(rawChunks); // symbol index uses original chunks
      }
      if (this.deps.embeddingProvider && this.deps.vectorStore && this.deps.embeddingConfig) {
        const texts = finalChunks.map((c) => c.text);
        const vectors = await this.deps.embeddingProvider.embed(texts);
        if (vectors.length !== finalChunks.length) {
          throw new Error(
            `Embedding provider returned ${vectors.length} vectors for ${finalChunks.length} chunks (${relativePath})`
          );
        }
        for (let i = 0; i < finalChunks.length; i++) {
          await this.deps.vectorStore.upsert({
            chunkId: finalChunks[i]!.id,
            repositoryId,
            relativePath: finalChunks[i]!.relativePath,
            model: this.deps.embeddingConfig.model,
            dimensions: this.deps.embeddingConfig.dimensions,
            vector: vectors[i]!
          });
        }
        this.deps.logger?.debug("index.embedded", { relativePath, chunks: finalChunks.length, originalChunks: rawChunks.length });
      }
      chunksIndexed += finalChunks.length;
      this.deps.logger?.debug("index.file", { relativePath, chunks: finalChunks.length });
    }

    const discovered = new Set(files);
    const storedFiles = await this.deps.metadataStore.listFiles(repositoryId);
    for (const record of storedFiles) {
      if (discovered.has(record.relativePath)) continue;
      await this.deps.metadataStore.deleteChunksForFile(repositoryId, record.relativePath);
      await this.deps.keywordIndex.removeChunksForFile(repositoryId, record.relativePath);
      if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, record.relativePath);
      if (this.deps.symbolIndex) await this.deps.symbolIndex.removeSymbolsForFile(repositoryId, record.relativePath);
      await this.deps.metadataStore.deleteFile(repositoryId, record.relativePath);
      this.deps.logger?.debug("index.pruned", { relativePath: record.relativePath });
    }

    this.deps.logger?.debug("index.done", {
      repositoryId,
      filesIndexed: files.length,
      chunksIndexed,
      elapsedMs: Math.round(performance.now() - start)
    });

    return { repositoryId, filesIndexed: files.length, chunksIndexed };
  }
}

function createRepositoryId(rootPath: string): string {
  return sha256(resolve(rootPath)).slice(0, 16);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
