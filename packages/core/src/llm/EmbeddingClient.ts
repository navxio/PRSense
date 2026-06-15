// packages/core/src/llm/EmbeddingClient.ts
export interface EmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
  dimension(): Promise<number>;
  maxInputChars?: number;
}
