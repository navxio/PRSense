import { Pool } from "pg";
import { VectorStore, StoredChunk, RepositoryId } from "@prsense/context";

/* ---------------------------------- */
/* SQL (pure data)                     */
/* ---------------------------------- */

const SQL = {
  upsert: `
    INSERT INTO rag_chunks (
      id,
      repo_provider,
      repo_owner,
      repo_name,
      repo_ref,
      path,
      kind,
      language,
      content,
      line_start,
      line_end,
      embedding,
      indexed_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      indexed_at = NOW()
  `,

  query: `
    SELECT
      id,
      repo_provider,
      repo_owner,
      repo_name,
      repo_ref,
      path,
      kind,
      language,
      content,
      line_start,
      line_end,
      embedding,
      indexed_at,
      embedding <-> $1 AS distance
    FROM rag_chunks
    WHERE
      repo_provider = $2
      AND repo_name = $3
      AND ($4::text IS NULL OR repo_ref = $4)
    ORDER BY embedding <-> $1
    LIMIT $5
  `,

  deleteByRepo: `
    DELETE FROM rag_chunks
    WHERE
      repo_provider = $1
      AND repo_name = $2
      AND ($3::text IS NULL OR repo_ref = $3)
  `,
};

/* ---------------------------------- */
/* Pure mapping                        */
/* ---------------------------------- */

const rowToStoredChunk = (row: any): StoredChunk => ({
  id: row.id,
  repo: {
    provider: row.repo_provider,
    owner: row.repo_owner ?? undefined,
    name: row.repo_name,
    ref: row.repo_ref ?? undefined,
  },
  path: row.path,
  kind: row.kind,
  language: row.language ?? undefined,
  content: row.content,
  lineStart: row.line_start ?? undefined,
  lineEnd: row.line_end ?? undefined,
  embedding: row.embedding,
  indexedAt: row.indexed_at,
});

/* ---------------------------------- */
/* Effectful operations                */
/* ---------------------------------- */

const upsertChunks =
  (pool: Pool) =>
  async (chunks: StoredChunk[]): Promise<void> => {
    if (chunks.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const chunk of chunks) {
        await client.query(SQL.upsert, [
          chunk.id,
          chunk.repo.provider,
          chunk.repo.owner ?? null,
          chunk.repo.name,
          chunk.repo.ref ?? null,
          chunk.path,
          chunk.kind,
          chunk.language ?? null,
          chunk.content,
          chunk.lineStart ?? null,
          chunk.lineEnd ?? null,
          chunk.embedding,
        ]);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  };

const queryChunks =
  (pool: Pool) =>
  async (params: {
    embedding: number[];
    limit: number;
    repo: RepositoryId;
  }): Promise<StoredChunk[]> => {
    const { embedding, limit, repo } = params;

    const result = await pool.query(SQL.query, [
      embedding,
      repo.provider,
      repo.name,
      repo.ref ?? null,
      limit,
    ]);

    return result.rows.map(rowToStoredChunk);
  };

const deleteChunksByRepo =
  (pool: Pool) =>
  async (repo: RepositoryId): Promise<void> => {
    await pool.query(SQL.deleteByRepo, [
      repo.provider,
      repo.name,
      repo.ref ?? null,
    ]);
  };

/* ---------------------------------- */
/* Public factory                      */
/* ---------------------------------- */

export const createPgVectorStore = (pool: Pool): VectorStore => ({
  upsert: upsertChunks(pool),
  query: queryChunks(pool),
  deleteByRepo: deleteChunksByRepo(pool),
});
