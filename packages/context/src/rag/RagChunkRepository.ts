// packages/context/src/rag/RagChunkRepository.ts
import { ContextChunk } from "@prsense/core";

export interface ChunkRow {
  chunk: ContextChunk;
  repoProvider: string;
  repoOwner?: string;
  repoName: string;
  repoRef: string;
  embedding: number[];
}

export interface SearchNearestParams {
  repoProvider: string;
  repoName: string;
  repoRef?: string;
  embedding: number[];
  limit: number;
  excludePaths?: string[];
}

export interface NearestChunk {
  id: string;
  path: string;
  kind: string;
  language: string | null;
  content: string;
  lineStart: number | null;
  lineEnd: number | null;
  distance: number;
}

export interface RagChunkRepository {
  /** Replace all chunks for a repository in a single transaction. */
  rebuildRepository(
    provider: string,
    name: string,
    rows: ChunkRow[],
  ): Promise<void>;

  /** Append chunks. No deletion. */
  insertChunks(rows: ChunkRow[]): Promise<void>;

  /** Delete all chunks belonging to (provider, name). */
  deleteByRepository(provider: string, name: string): Promise<void>;

  /** Delete chunks for specific paths within (provider, name). */
  deleteByPaths(provider: string, name: string, paths: string[]): Promise<void>;

  /** KNN search over embeddings, filtered by repository identity. */
  searchNearest(params: SearchNearestParams): Promise<NearestChunk[]>;

  ensureSchema(embeddingDimension: number): Promise<void>;
}
