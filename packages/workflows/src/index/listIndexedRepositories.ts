// packages/workflows/src/index/listIndexedRepositories.ts
import { IndexMetadataRepository } from "@prsense/context";
import type { IndexedRepository } from "@prsense/core";

export async function listIndexedRepositories(
  repo: IndexMetadataRepository,
): Promise<IndexedRepository[]> {
  return repo.list();
}
