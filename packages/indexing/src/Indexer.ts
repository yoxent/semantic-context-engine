import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { IChunker, IKeywordIndex, IMetadataStore, RepositoryType, SceConfig } from "@sce/core";
import { defaultConfig } from "@sce/core";
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
  config?: Pick<SceConfig, "indexing">;
}

export class IndexingService {
  constructor(private readonly deps: IndexingServiceDeps) {}

  async indexRepository(options: IndexRepositoryOptions): Promise<IndexRepositoryResult> {
    const rootPath = resolve(options.rootPath);
    const repositoryId = options.repositoryId ?? createRepositoryId(rootPath);
    const indexing = this.deps.config?.indexing ?? defaultConfig.indexing;

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

    let chunksIndexed = 0;
    for (const relativePath of files) {
      const absolutePath = join(rootPath, relativePath);
      const text = await readFile(absolutePath, "utf8");
      const fileHash = sha256(text);
      const existing = await this.deps.metadataStore.getFile(repositoryId, relativePath);
      if (existing?.fileHash === fileHash) continue;

      await this.deps.metadataStore.deleteChunksForFile(repositoryId, relativePath);
      await this.deps.keywordIndex.removeChunksForFile(repositoryId, relativePath);

      const chunks = this.deps.chunker.chunk({
        repositoryId,
        relativePath,
        language: languageFor(relativePath),
        fileHash,
        text
      });

      await this.deps.metadataStore.saveFile({
        repositoryId,
        relativePath,
        language: languageFor(relativePath),
        fileHash,
        indexedAt: new Date()
      });
      await this.deps.metadataStore.saveChunks(chunks);
      await this.deps.keywordIndex.indexChunks(chunks);
      chunksIndexed += chunks.length;
    }

    const discovered = new Set(files);
    const storedFiles = await this.deps.metadataStore.listFiles(repositoryId);
    for (const record of storedFiles) {
      if (discovered.has(record.relativePath)) continue;
      await this.deps.metadataStore.deleteChunksForFile(repositoryId, record.relativePath);
      await this.deps.keywordIndex.removeChunksForFile(repositoryId, record.relativePath);
      await this.deps.metadataStore.deleteFile(repositoryId, record.relativePath);
    }

    return { repositoryId, filesIndexed: files.length, chunksIndexed };
  }
}

function createRepositoryId(rootPath: string): string {
  return sha256(resolve(rootPath)).slice(0, 16);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function languageFor(relativePath: string): string {
  return relativePath.endsWith(".md") ? "markdown" : "text";
}
