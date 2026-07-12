import { SemanticContextEngine } from "@sce/core";
import { IndexingService } from "@sce/indexing";
import { MarkdownChunker } from "@sce/parsing";
import { SimpleRanker } from "@sce/ranking";
import { KeywordRetrievalStrategy } from "@sce/retrieval";
import { SqliteStorage } from "@sce/storage";

export async function createEngine(rootPath: string): Promise<{ engine: SemanticContextEngine; close: () => void }> {
  const storage = await SqliteStorage.open(rootPath);
  const ranker = new SimpleRanker();
  const keywordStrategy = new KeywordRetrievalStrategy({ keywordIndex: storage, ranker });
  const indexingService = new IndexingService({
    chunker: new MarkdownChunker(),
    metadataStore: storage,
    keywordIndex: storage
  });

  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      indexingService,
      metadataStore: storage
    }),
    close: () => storage.close()
  };
}
