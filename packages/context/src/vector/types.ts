import { Chunk } from "../indexing/Chunk.js";
import { EmbeddingVector } from "../embeddings/types.js";
import { RepositoryId } from "../repository/RepositorySource.js";

export type StoredChunk = Chunk & {
  embedding: EmbeddingVector;
  indexedAt: Date;
};

export interface VectorStore {
  upsert(chunks: StoredChunk[]): Promise<void>;

  query(params: {
    embedding: EmbeddingVector;
    limit: number;
    repo: RepositoryId;
  }): Promise<StoredChunk[]>;

  deleteByRepo(repo: RepositoryId): Promise<void>;
}
