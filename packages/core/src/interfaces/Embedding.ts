export interface IEmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}
