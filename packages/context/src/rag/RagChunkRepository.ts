import { ContextChunk } from "@prsense/core";

export interface RagChunkRepository {
  deleteByRepository(
    provider: string,
    name: string,
    ref: string,
  ): Promise<void>;

  insertChunks(
    rows: Array<{
      chunk: ContextChunk;
      repoProvider: string;
      repoOwner?: string;
      repoName: string;
      repoRef: string;
      embedding: number[];
    }>,
  ): Promise<void>;
}
