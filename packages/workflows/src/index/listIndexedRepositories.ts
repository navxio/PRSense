import type { ResolvedConfig } from "@prsense/runtime-config";
import { PostgresIndexMetadataRepository } from "@prsense/context";
import type { IndexedRepository } from "@prsense/core";

export async function listIndexedRepositories(
  config: ResolvedConfig,
): Promise<IndexedRepository[]> {
  const repo = new PostgresIndexMetadataRepository(config.database.url);

  return repo.list();
}
