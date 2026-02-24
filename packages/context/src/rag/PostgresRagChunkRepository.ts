// packages/context/src/rag/PostgresRagChunkRepository.ts
import pg from "pg";
import type { RagChunkRepository } from "./RagChunkRepository.js";
import type { ContextChunk } from "@prsense/core";

export class PostgresRagChunkRepository implements RagChunkRepository {
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

  async getEmbeddingColumnDimension(): Promise<number | null> {
    return this.withClient(async (client) => {
      const result = await client.query(`
      SELECT
        a.atttypmod AS dimension
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      WHERE c.relname = 'rag_chunks'
        AND a.attname = 'embedding'
    `);

      if (result.rows.length === 0) {
        return null;
      }

      return Number(result.rows[0].dimension);
    });
  }

  async rebuildRepository(
    provider: string,
    name: string,
    rows: Array<{
      chunk: ContextChunk;
      repoProvider: string;
      repoOwner?: string;
      repoName: string;
      repoRef: string;
      embedding: number[];
    }>,
  ): Promise<void> {
    const client = new pg.Client({
      connectionString: this.connectionString,
    });

    await client.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
      DELETE FROM rag_chunks
      WHERE repo_provider = $1
        AND repo_name = $2
      `,
        [provider, name],
      );

      const insertText = `
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
        embedding
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
    `;

      for (const row of rows) {
        const { chunk } = row;

        await client.query(insertText, [
          chunk.id,
          row.repoProvider,
          row.repoOwner ?? null,
          row.repoName,
          row.repoRef,
          chunk.source.kind === "file" ? chunk.source.path : null,
          chunk.source.kind,
          chunk.metadata?.language ?? null,
          chunk.content,
          chunk.metadata?.lineStart ?? null,
          chunk.metadata?.lineEnd ?? null,
          `[${row.embedding.join(",")}]`,
        ]);
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      await client.end().catch(() => {});
    }
  }

  async deleteByRepository(provider: string, name: string): Promise<void> {
    await this.withClient(async (client) => {
      await client.query(
        `
        DELETE FROM rag_chunks
        WHERE repo_provider = $1
          AND repo_name = $2
        `,
        [provider, name],
      );
    });
  }

  async insertChunks(
    rows: Array<{
      chunk: ContextChunk;
      repoProvider: string;
      repoOwner?: string;
      repoName: string;
      repoRef: string;
      embedding: number[];
    }>,
  ): Promise<void> {
    if (rows.length === 0) return;

    await this.withClient(async (client) => {
      const text = `
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
          embedding
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
      `;

      for (const row of rows) {
        const { chunk } = row;

        await client.query(text, [
          chunk.id,
          row.repoProvider,
          row.repoOwner ?? null,
          row.repoName,
          row.repoRef,
          chunk.metadata?.path ?? null,
          chunk.metadata?.kind ?? "code",
          chunk.metadata?.language ?? null,
          chunk.content,
          chunk.metadata?.lineStart ?? null,
          chunk.metadata?.lineEnd ?? null,
          `[${row.embedding.join(",")}]`,
        ]);
      }
    });
  }

  async searchNearest(params: {
    repoProvider: string;
    repoName: string;
    repoRef?: string;
    embedding: number[];
    limit: number;
  }): Promise<
    Array<{
      id: string;
      path: string;
      kind: string;
      language: string | null;
      content: string;
      lineStart: number | null;
      lineEnd: number | null;
      distance: number;
    }>
  > {
    const client = new pg.Client({
      connectionString: this.connectionString,
    });

    await client.connect();

    try {
      const query = `
      SELECT
        id,
        path,
        kind,
        language,
        content,
        line_start,
        line_end,
        embedding <-> $1 AS distance
      FROM rag_chunks
      WHERE repo_provider = $2
        AND repo_name = $3
        ${params.repoRef ? "AND repo_ref = $4" : ""}
      ORDER BY embedding <-> $1
      LIMIT ${params.limit}
    `;

      const vectorLiteral = `[${params.embedding.join(",")}]`;

      const values = params.repoRef
        ? [vectorLiteral, params.repoProvider, params.repoName, params.repoRef]
        : [vectorLiteral, params.repoProvider, params.repoName];

      const result = await client.query(query, values);

      return result.rows.map((row) => ({
        id: row.id,
        path: row.path,
        kind: row.kind,
        language: row.language,
        content: row.content,
        lineStart: row.line_start,
        lineEnd: row.line_end,
        distance: row.distance,
      }));
    } finally {
      await client.end().catch(() => {});
    }
  }
}
