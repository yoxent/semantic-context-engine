import type { Chunk, ChunkInput, IChunker, Language } from "@sce/core";

export interface LanguageChunkerRegistryOptions {
  chunkers: Partial<Record<Exclude<Language, "text">, IChunker>>;
}

export class LanguageChunkerRegistry implements IChunker {
  constructor(private readonly options: LanguageChunkerRegistryOptions) {}

  chunk(input: ChunkInput): Chunk[] {
    const chunker = this.options.chunkers[input.language as Exclude<Language, "text">];
    if (!chunker) {
      throw new Error(`No chunker registered for language: ${input.language}`);
    }
    return chunker.chunk(input);
  }
}