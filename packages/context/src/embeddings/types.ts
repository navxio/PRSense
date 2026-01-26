export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  embed(input: { text: string; model?: string }): Promise<{
    vector: number[];
    dimensions: number;
  }>;
}
