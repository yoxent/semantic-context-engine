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
import { MarkdownChunker, LanguageChunkerRegistry, TreeSitterCodeChunker } from "@sce/parsing";
import { SimpleRanker } from "@sce/ranking";
import { AstRetrievalStrategy, HybridRetrievalStrategy, KeywordRetrievalStrategy, SemanticRetrievalStrategy } from "@sce/retrieval";
import { SqliteStorage, SqliteSymbolIndex, SqliteVectorStore } from "@sce/storage";

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

  const hybridStrategy =
    semanticStrategy
      ? new HybridRetrievalStrategy({
          keywordStrategy,
          semanticStrategy,
          defaultLimit: config.search.defaultLimit
        })
      : undefined;

  const markdownChunker = new MarkdownChunker();
  const typescriptChunker = await TreeSitterCodeChunker.create("typescript", logger.child({ component: "parsing" }));
  const javascriptChunker = await TreeSitterCodeChunker.create("javascript", logger.child({ component: "parsing" }));
  const chunker = new LanguageChunkerRegistry({
    chunkers: { markdown: markdownChunker, typescript: typescriptChunker, javascript: javascriptChunker }
  });

  const symbolIndex = SqliteSymbolIndex.attach(storage.getDatabase());
  const astStrategy = new AstRetrievalStrategy({
    symbolIndex,
    metadataStore: storage,
    defaultLimit: config.search.defaultLimit,
    maxSnippetChars: config.search.maxSnippetChars
  });

  const indexingService = new IndexingService({
    chunker,
    metadataStore: storage,
    keywordIndex: storage,
    symbolIndex,
    ...(embeddingProvider ? { embeddingProvider } : {}),
    ...(vectorStore ? { vectorStore } : {}),
    ...(embeddingConfig ? { embeddingConfig } : {}),
    config,
    logger: logger.child({ component: "indexing" })
  });

  return {
    engine: new SemanticContextEngine({
      keywordStrategy,
      astStrategy,
      ...(semanticStrategy ? { semanticStrategy } : {}),
      ...(hybridStrategy ? { hybridStrategy } : {}),
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
