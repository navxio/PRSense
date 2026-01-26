export interface VectorStore {
  upsert(input: {
    id: string;
    vector: number[];
    metadata: {
      repo: string;
      path: string;
      chunkStart?: number;
      chunkEnd?: number;
    };
  }): Promise<void>;
}
