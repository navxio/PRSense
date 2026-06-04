// packages/context/src/rag/SqliteRagChunkRepository.ts
import type { RagChunkRepository, ChunkRow } from "./RagChunkRepository.js";
import { ensureVecTable, type Db } from "../db/SqliteDatabase.js";

function toF32(embedding: number[]): Uint8Array {
  // sqlite-vec accepts a float[] as the raw bytes of a Float32Array.
  return new Uint8Array(new Float32Array(embedding).buffer);
}

export class SqliteRagChunkRepository implements RagChunkRepository {
  constructor(private readonly db: Db) {}

  private insertRow(row: ChunkRow): void {
    const { chunk } = row;
    const sourcePath = chunk.source.kind === "file" ? chunk.source.path : null;
    const contentKind = chunk.metadata?.kind ?? "code";

    this.db
      .prepare(
        `INSERT INTO rag_chunks (
         id, repo_provider, repo_owner, repo_name, repo_ref,
         path, kind, language, content, line_start, line_end
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        chunk.id,
        row.repoProvider,
        row.repoOwner ?? null,
        row.repoName,
        row.repoRef,
        sourcePath,
        contentKind,
        chunk.metadata?.language ?? null,
        chunk.content,
        chunk.metadata?.lineStart ?? null,
        chunk.metadata?.lineEnd ?? null,
      );

    this.db
      .prepare(
        `INSERT INTO vec_rag_chunks (rowid, embedding)
       VALUES (last_insert_rowid(), ?)`,
      )
      .run(toF32(row.embedding));
  }

  async rebuildRepository(
    provider: string,
    name: string,
    rows: ChunkRow[],
  ): Promise<void> {
    const tx = this.db.transaction((rows: ChunkRow[]) => {
      // Delete vec rows first (they reference rag_chunks rowids).
      this.db
        .prepare(
          `DELETE FROM vec_rag_chunks
           WHERE rowid IN (
             SELECT rowid FROM rag_chunks
             WHERE repo_provider = ? AND repo_name = ?
           )`,
        )
        .run(provider, name);

      this.db
        .prepare(
          `DELETE FROM rag_chunks
           WHERE repo_provider = ? AND repo_name = ?`,
        )
        .run(provider, name);

      for (const row of rows) this.insertRow(row);
    });

    tx(rows);
  }

  async insertChunks(rows: ChunkRow[]): Promise<void> {
    if (rows.length === 0) return;

    const tx = this.db.transaction((rows: ChunkRow[]) => {
      for (const row of rows) this.insertRow(row);
    });
    tx(rows);
  }

  async deleteByRepository(provider: string, name: string): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `DELETE FROM vec_rag_chunks
           WHERE rowid IN (
             SELECT rowid FROM rag_chunks
             WHERE repo_provider = ? AND repo_name = ?
           )`,
        )
        .run(provider, name);
      this.db
        .prepare(
          `DELETE FROM rag_chunks WHERE repo_provider = ? AND repo_name = ?`,
        )
        .run(provider, name);
    });
    tx();
  }

  async deleteByPaths(
    provider: string,
    name: string,
    paths: string[],
  ): Promise<void> {
    if (paths.length === 0) return;

    const placeholders = paths.map(() => "?").join(",");
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `DELETE FROM vec_rag_chunks
           WHERE rowid IN (
             SELECT rowid FROM rag_chunks
             WHERE repo_provider = ? AND repo_name = ?
               AND path IN (${placeholders})
           )`,
        )
        .run(provider, name, ...paths);
      this.db
        .prepare(
          `DELETE FROM rag_chunks
           WHERE repo_provider = ? AND repo_name = ?
             AND path IN (${placeholders})`,
        )
        .run(provider, name, ...paths);
    });
    tx();
  }

  async searchNearest(params: {
    repoProvider: string;
    repoName: string;
    repoRef?: string;
    embedding: number[];
    limit: number;
    excludePaths?: string[];
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
    const limit = Math.max(1, Math.floor(params.limit));

    const excludeCount = params.excludePaths?.length ?? 0;

    // sqlite-vec KNN applies `k` BEFORE our metadata filters in the join,
    // so over-fetch then trim — same strategy as the Postgres version.
    const FETCH_CEILING = 200;
    const k = Math.min(limit + excludeCount, FETCH_CEILING);

    const filters: string[] = [
      "c.repo_provider = @provider",
      "c.repo_name = @name",
    ];
    const bind: Record<string, unknown> = {
      provider: params.repoProvider,
      name: params.repoName,
      query: toF32(params.embedding),
      k,
    };

    if (params.repoRef) {
      filters.push("c.repo_ref = @ref");
      bind.ref = params.repoRef;
    }

    if (params.excludePaths && params.excludePaths.length > 0) {
      const ph = params.excludePaths.map((_, i) => `@ex${i}`);
      filters.push(`c.path NOT IN (${ph.join(",")})`);
      params.excludePaths.forEach((p, i) => (bind[`ex${i}`] = p));
    }

    const sql = `
      SELECT
        c.id          AS id,
        c.path        AS path,
        c.kind        AS kind,
        c.language    AS language,
        c.content     AS content,
        c.line_start  AS lineStart,
        c.line_end    AS lineEnd,
        v.distance    AS distance
      FROM vec_rag_chunks v
      JOIN rag_chunks c ON c.rowid = v.rowid
      WHERE v.embedding MATCH @query
        AND k = @k
        AND ${filters.join("\n        AND ")}
      ORDER BY v.distance
      LIMIT ${limit}
    `;

    return this.db.prepare(sql).all(bind) as Array<{
      id: string;
      path: string;
      kind: string;
      language: string | null;
      content: string;
      lineStart: number | null;
      lineEnd: number | null;
      distance: number;
    }>;
  }

  async ensureSchema(embeddingDimension: number): Promise<void> {
    ensureVecTable(this.db, embeddingDimension);
  }
}
