// packages/context/src/index/SqliteIndexMetadataRepository.ts
import { IndexMetadata, IndexedRepository } from "@prsense/core";
import { IndexMetadataRepository } from "./IndexMetadataRepository.js";
import type { Db } from "../db/SqliteDatabase.js";

export class SqliteIndexMetadataRepository implements IndexMetadataRepository {
  constructor(private readonly db: Db) {}

  async load(
    repositoryProvider: string,
    repositoryId: string,
  ): Promise<IndexMetadata | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM prsense_index_metadata
         WHERE repository_provider = ? AND repository_id = ?`,
      )
      .get(repositoryProvider, repositoryId) as Record<string, any> | undefined;

    if (!row) return null;

    return {
      repository: {
        provider: row.repository_provider,
        id: row.repository_id,
      },
      revision: {
        commitSha: row.commit_sha,
      },
      embedding: {
        provider: row.embedding_provider,
        model: row.embedding_model,
        dimension: Number(row.embedding_dimension),
      },
      chunking: {
        strategy: row.chunk_strategy,
        version: row.chunk_version,
      },
      prsenseVersion: row.prsense_version,
      // stored as unix seconds; expose ISO to match the PG repo's contract
      createdAt: new Date(Number(row.created_at) * 1000).toISOString(),
    };
  }

  async save(metadata: IndexMetadata): Promise<void> {
    // createdAt may arrive as ISO string (PG contract) or epoch; normalize to seconds.
    const createdAt =
      typeof metadata.createdAt === "string"
        ? Math.floor(new Date(metadata.createdAt).getTime() / 1000)
        : Math.floor(Number(metadata.createdAt) / 1000);

    this.db
      .prepare(
        `INSERT INTO prsense_index_metadata (
           repository_provider, repository_id, commit_sha,
           embedding_provider, embedding_model, embedding_dimension,
           chunk_strategy, chunk_version, prsense_version, created_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (repository_provider, repository_id)
         DO UPDATE SET
           commit_sha          = excluded.commit_sha,
           embedding_provider  = excluded.embedding_provider,
           embedding_model     = excluded.embedding_model,
           embedding_dimension = excluded.embedding_dimension,
           chunk_strategy      = excluded.chunk_strategy,
           chunk_version       = excluded.chunk_version,
           prsense_version     = excluded.prsense_version,
           created_at          = excluded.created_at`,
      )
      .run(
        metadata.repository.provider,
        metadata.repository.id,
        metadata.revision.commitSha,
        metadata.embedding.provider,
        metadata.embedding.model,
        metadata.embedding.dimension,
        metadata.chunking.strategy,
        metadata.chunking.version,
        metadata.prsenseVersion,
        createdAt,
      );
  }

  async delete(
    repositoryProvider: string,
    repositoryId: string,
  ): Promise<void> {
    this.db
      .prepare(
        `DELETE FROM prsense_index_metadata
         WHERE repository_provider = ? AND repository_id = ?`,
      )
      .run(repositoryProvider, repositoryId);
  }

  async list(): Promise<IndexedRepository[]> {
    const rows = this.db
      .prepare(
        `SELECT repository_provider, repository_id, commit_sha,
                created_at, embedding_provider, embedding_model
         FROM prsense_index_metadata`,
      )
      .all() as Array<Record<string, any>>;

    return rows.map((r) => ({
      provider: r.repository_provider,
      repository: r.repository_id,
      commitSha: r.commit_sha,
      indexedAt: Number(r.created_at),
      embeddingProvider: r.embedding_provider,
      embeddingModel: r.embedding_model,
    }));
  }
}
