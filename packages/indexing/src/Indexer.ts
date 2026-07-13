import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  IChunker,
  IEmbeddingProvider,
  IKeywordIndex,
  IMetadataStore,
  IVectorStore,
  Logger,
  RepositoryType,
  SceConfig
} from "@sce/core";
import { defaultConfig, detectLanguage } from "@sce/core";
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

      const chunks = this.deps.chunker.chunk({
        repositoryId,
        relativePath,
        language,
        fileHash,
        text
      });

      await this.deps.metadataStore.saveFile({
        repositoryId,
        relativePath,
        language,
        fileHash,
        indexedAt: new Date()
      });
      await this.deps.metadataStore.saveChunks(chunks);
      await this.deps.keywordIndex.indexChunks(chunks);
      if (this.deps.embeddingProvider && this.deps.vectorStore && this.deps.embeddingConfig) {
        const texts = chunks.map((c) => c.text);
        const vectors = await this.deps.embeddingProvider.embed(texts);
        if (vectors.length !== chunks.length) {
          throw new Error(
            `Embedding provider returned ${vectors.length} vectors for ${chunks.length} chunks (${relativePath})`
          );
        }
        for (let i = 0; i < chunks.length; i++) {
          await this.deps.vectorStore.upsert({
            chunkId: chunks[i]!.id,
            repositoryId,
            relativePath: chunks[i]!.relativePath,
            model: this.deps.embeddingConfig.model,
            dimensions: this.deps.embeddingConfig.dimensions,
            vector: vectors[i]!
          });
        }
        this.deps.logger?.debug("index.embedded", { relativePath, chunks: chunks.length });
      }
      chunksIndexed += chunks.length;
      this.deps.logger?.debug("index.file", { relativePath, chunks: chunks.length });
    }

    const discovered = new Set(files);
    const storedFiles = await this.deps.metadataStore.listFiles(repositoryId);
    for (const record of storedFiles) {
      if (discovered.has(record.relativePath)) continue;
      await this.deps.metadataStore.deleteChunksForFile(repositoryId, record.relativePath);
      await this.deps.keywordIndex.removeChunksForFile(repositoryId, record.relativePath);
      if (this.deps.vectorStore) await this.deps.vectorStore.deleteByFile(repositoryId, record.relativePath);
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
