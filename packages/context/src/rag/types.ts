// packages/context/src/providers/rag/types.ts
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}
