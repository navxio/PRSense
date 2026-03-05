import pg from "pg";
import { IndexMetadata, IndexedRepository } from "@prsense/core";
import { IndexMetadataRepository } from "./IndexMetadataRepository.js";

export class PostgresIndexMetadataRepository implements IndexMetadataRepository {
  constructor(private readonly connectionString: string) {}

  private async withClient<T>(
    fn: (client: pg.Client) => Promise<T>,
  ): Promise<T> {
    const client = new pg.Client({
      connectionString: this.connectionString,
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end().catch(() => {});
    }
  }

  async load(
    repositoryProvider: string,
    repositoryId: string,
  ): Promise<IndexMetadata | null> {
    return this.withClient(async (client) => {
      const res = await client.query(
        `
        SELECT *
        FROM prsense_index_metadata
        WHERE repository_provider = $1
          AND repository_id = $2
        `,
        [repositoryProvider, repositoryId],
      );

      if (res.rowCount === 0) {
        return null;
      }

      const row = res.rows[0];

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
        createdAt: row.created_at.toISOString(),
      };
    });
  }

  async save(metadata: IndexMetadata): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(
        `
        INSERT INTO prsense_index_metadata (
          repository_provider,
          repository_id,
          commit_sha,
          embedding_provider,
          embedding_model,
          embedding_dimension,
          chunk_strategy,
          chunk_version,
          prsense_version,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (repository_provider, repository_id)
        DO UPDATE SET
          commit_sha = EXCLUDED.commit_sha,
          embedding_provider = EXCLUDED.embedding_provider,
          embedding_model = EXCLUDED.embedding_model,
          embedding_dimension = EXCLUDED.embedding_dimension,
          chunk_strategy = EXCLUDED.chunk_strategy,
          chunk_version = EXCLUDED.chunk_version,
          prsense_version = EXCLUDED.prsense_version,
          created_at = EXCLUDED.created_at
        `,
        [
          metadata.repository.provider,
          metadata.repository.id,
          metadata.revision.commitSha,
          metadata.embedding.provider,
          metadata.embedding.model,
          metadata.embedding.dimension,
          metadata.chunking.strategy,
          metadata.chunking.version,
          metadata.prsenseVersion,
          metadata.createdAt,
        ],
      );
    });
  }

  async delete(
    repositoryProvider: string,
    repositoryId: string,
  ): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(
        `
        DELETE FROM prsense_index_metadata
        WHERE repository_provider = $1
          AND repository_id = $2
        `,
        [repositoryProvider, repositoryId],
      );
    });
  }

  async list(): Promise<IndexedRepository[]> {
    const client = new pg.Client({
      connectionString: this.connectionString,
    });

    await client.connect();

    try {
      const res = await client.query(`
        SELECT
        repository_provider,
        repository_id,
        commit_sha,
        created_at,
        embedding_provider,
        embedding_model
        FROM prsense_index_metadata
    `);

      return res.rows.map((r) => ({
        provider: r.repository_provider,
        repository: r.repository_id,
        commitSha: r.commit_sha,
        indexedAt: Number(r.created_at),
        embeddingProvider: r.embedding_provider,
        embeddingModel: r.embedding_model,
      }));
    } finally {
      await client.end();
    }
  }
}
