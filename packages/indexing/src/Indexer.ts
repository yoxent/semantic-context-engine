import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IChunker, IKeywordIndex, IMetadataStore, RepositoryType } from "@sce/core";
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
}

export class IndexingService {
  constructor(private readonly deps: IndexingServiceDeps) {}

  async indexRepository(options: IndexRepositoryOptions): Promise<IndexRepositoryResult> {
    const repositoryId = options.repositoryId ?? createRepositoryId(options.rootPath);
    await this.deps.metadataStore.saveRepository({
      id: repositoryId,
      rootPath: options.rootPath,
      type: options.type,
      indexedAt: new Date()
    });

    const files = await discoverFiles({
      rootPath: options.rootPath,
      include: defaultConfig.indexing.include,
      ignore: defaultConfig.indexing.ignore
    });

    let chunksIndexed = 0;
    for (const relativePath of files) {
      const absolutePath = join(options.rootPath, relativePath);
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

    return { repositoryId, filesIndexed: files.length, chunksIndexed };
  }
}

function createRepositoryId(rootPath: string): string {
  return sha256(rootPath).slice(0, 16);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function languageFor(relativePath: string): string {
  return relativePath.endsWith(".md") ? "markdown" : "text";
}
