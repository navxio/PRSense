export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingVector>;
}
