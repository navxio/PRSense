import { IndexedRepository, IndexMetadata } from "@prsense/core";

export interface IndexMetadataRepository {
  load(
    repositoryProvider: string,
    repositoryId: string,
  ): Promise<IndexMetadata | null>;

  save(metadata: IndexMetadata): Promise<void>;

  delete(repositoryProvider: string, repositoryId: string): Promise<void>;
  list(): Promise<IndexedRepository[]>;
}
