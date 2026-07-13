import { resolve } from "node:path";
import { Command } from "commander";
import { exportIndex, type ExportResult } from "@sce/core";
import { SqliteStorage, SqliteVectorStore, SqliteSymbolIndex } from "@sce/storage";

export const exportCommand = new Command("export")
  .description("Export index to JSON for D1 import")
  .option("-o, --output <dir>", "Output directory", "./sce-export")
  .option("-m, --model <model>", "Embedding model ID", "nvidia/llama-nemotron-embed-vl-1b-v2:free")
  .option("-d, --dimensions <n>", "Embedding dimensions", "2048")
  .option("--path <path>", "Root path containing .sce directory", ".")
  .action(async (options) => {
    const rootPath = resolve(options.path);
    const storage = await SqliteStorage.open(rootPath);
    try {
      const db = storage.getDatabase();
      const vectorStore = SqliteVectorStore.attach(db);
      const symbolIndex = SqliteSymbolIndex.attach(db);

      const result: ExportResult = await exportIndex(
        { metadataStore: storage, vectorStore, symbolIndex },
        options.model,
        parseInt(options.dimensions),
        resolve(options.output)
      );

      console.log("Export complete:");
      console.log(`  Chunks: ${result.meta.chunkCount}`);
      console.log(`  Vectors: ${result.meta.vectorCount}`);
      console.log(`  Symbols: ${result.meta.symbolCount}`);
      console.log(`  Output: ${result.outputDir}`);
    } finally {
      storage.close();
    }
  });
