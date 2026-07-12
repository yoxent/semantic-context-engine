import { resolve } from "node:path";
import { loadConfig, SemanticContextEngine, type SceConfig } from "@sce/core";
import { IndexingService } from "@sce/indexing";
import { MarkdownChunker } from "@sce/parsing";
import { SimpleRanker } from "@sce/ranking";
import { KeywordRetrievalStrategy } from "@sce/retrieval";
import { SqliteStorage } from "@sce/storage";

export interface CreateEngineResult {
  engine: SemanticContextEngine;
  config: SceConfig;
  rootPath: string;
  close: () => void;
}

export async function createEngine(rootPath: string): Promise<CreateEngineResult> {
  const resolvedRoot = resolve(rootPath);
  const config = await loadConfig(resolvedRoot);
  const storage = await SqliteStorage.open(resolvedRoot);
  const ranker = new SimpleRanker();
  const keywordStrategy = new KeywordRetrievalStrategy({ keywordIndex: storage, ranker });
  const indexingService = new IndexingService({
    chunker: new MarkdownChunker(),
    metadataStore: storage,
    keywordIndex: storage,
    config
  });

  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      indexingService,
      metadataStore: storage
    }),
    config,
    rootPath: resolvedRoot,
    close: () => storage.close()
  };
}
