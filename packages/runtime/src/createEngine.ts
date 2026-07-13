import { resolve } from "node:path";
import {
  createLogger,
  effectiveLogLevel,
  loadConfig,
  SemanticContextEngine,
  type Logger,
  type LogLevel,
  type SceConfig
} from "@sce/core";
import { createEmbeddingProvider } from "@sce/embedding";
import { IndexingService } from "@sce/indexing";
import { MarkdownChunker } from "@sce/parsing";
import { SimpleRanker } from "@sce/ranking";
import { KeywordRetrievalStrategy, SemanticRetrievalStrategy } from "@sce/retrieval";
import { SqliteStorage, SqliteVectorStore } from "@sce/storage";

export interface CreateEngineOptions {
  /** When true, raises effective log level to at least `debug`. */
  verbose?: boolean;
  /** Override config logging level after load. */
  logLevel?: LogLevel;
  logger?: Logger;
}

export interface CreateEngineResult {
  engine: SemanticContextEngine;
  config: SceConfig;
  rootPath: string;
  logger: Logger;
  close: () => void;
}

export async function createEngine(rootPath: string, options: CreateEngineOptions = {}): Promise<CreateEngineResult> {
  const resolvedRoot = resolve(rootPath);
  const config = await loadConfig(resolvedRoot);
  const level =
    options.logLevel ??
    effectiveLogLevel(config.logging.level, Boolean(options.verbose));
  const logger = options.logger ?? createLogger({ level });
  const storage = await SqliteStorage.open(resolvedRoot);
  const ranker = new SimpleRanker();
  const keywordStrategy = new KeywordRetrievalStrategy({ keywordIndex: storage, ranker });

  const embeddingConfig = config.embedding;
  const vectorStore = embeddingConfig ? SqliteVectorStore.attach(storage.getDatabase()) : undefined;
  const embeddingProvider = embeddingConfig ? createEmbeddingProvider(embeddingConfig) : undefined;
  const semanticStrategy =
    embeddingConfig && vectorStore
      ? new SemanticRetrievalStrategy({
          embeddingProvider: embeddingProvider!,
          vectorStore,
          metadataStore: storage,
          ranker,
          model: embeddingConfig.model,
          dimensions: embeddingConfig.dimensions,
          defaultLimit: config.search.defaultLimit,
          maxSnippetChars: config.search.maxSnippetChars
        })
      : undefined;

  const indexingService = new IndexingService({
    chunker: new MarkdownChunker(),
    metadataStore: storage,
    keywordIndex: storage,
    ...(embeddingProvider ? { embeddingProvider } : {}),
    ...(vectorStore ? { vectorStore } : {}),
    ...(embeddingConfig ? { embeddingConfig } : {}),
    config,
    logger: logger.child({ component: "indexing" })
  });

  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      ...(semanticStrategy ? { semanticStrategy } : {}),
      indexingService,
      metadataStore: storage,
      logger: logger.child({ component: "engine" })
    }),
    config,
    rootPath: resolvedRoot,
    logger,
    close: () => storage.close()
  };
}