// packages/core/src/IndexedRepository.ts
export type IndexedRepository = {
  provider: string;
  repository: string;
  commitSha: string;
  indexedAt: number;
  embeddingProvider: string;
  embeddingModel: string;
};
