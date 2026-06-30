// packages/context/src/rag/SqliteRagChunkRepository.ts
import type { RagChunkRepository, ChunkRow } from "./RagChunkRepository.js";
import { Statement } from "better-sqlite3";
import {
  ensureVecTable,
  resolveVecTable,
  vecTableName,
  type Db,
} from "../db/SqliteDatabase.js";

function toF32(embedding: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(embedding).buffer);
}

export class SqliteRagChunkRepository implements RagChunkRepository {
  constructor(private readonly db: Db) {}

  // Prepared statements are cached per dim, since the vec table name
  // is part of the SQL text. Chunk insert is dim-independent.
  private _insertChunkStmt?: Statement;
  private readonly _insertVecStmts = new Map<number, Statement>();

  private get insertChunkStmt(): Statement {
    return (this._insertChunkStmt ??= this.db.prepare(
      `INSERT INTO rag_chunks (
         id, repo_provider, repo_owner, repo_name, repo_ref,
         path, kind, language, content, line_start, line_end
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ));
  }

  private insertVecStmt(dim: number): Statement {
    let stmt = this._insertVecStmts.get(dim);
    if (!stmt) {
      stmt = this.db.prepare(
        `INSERT INTO ${vecTableName(dim)} (rowid, embedding)
         VALUES (last_insert_rowid(), ?)`,
      );
      this._insertVecStmts.set(dim, stmt);
    }
    return stmt;
  }

  // INVARIANT: no other inserts may occur between insertChunkStmt and
  // insertVecStmt on this connection. The vec row depends on SQLite's
  // last_insert_rowid() referring to the chunk row we just inserted.
  private insertRow(row: ChunkRow, dim: number): void {
    const { chunk } = row;
    const sourcePath = chunk.source.kind === "file" ? chunk.source.path : null;
    const contentKind = chunk.metadata?.kind ?? "code";

    this.insertChunkStmt.run(
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

    this.insertVecStmt(dim).run(toF32(row.embedding));
  }

  async rebuildRepository(
    provider: string,
    name: string,
    dim: number,
    rows: ChunkRow[],
  ): Promise<void> {
    ensureVecTable(this.db, dim);

    // The repo may have previously been indexed at a different dim;
    // its old vec rows live in a different table. Clean both: the
    // table for the new dim (if any leftovers) AND any other dim
    // table that still holds rows for this repo.
    const tx = this.db.transaction((rows: ChunkRow[]) => {
      this.deleteAllVecRowsForRepo(provider, name);
      this.db
        .prepare(
          `DELETE FROM rag_chunks
           WHERE repo_provider = ? AND repo_name = ?`,
        )
        .run(provider, name);
      for (const row of rows) this.insertRow(row, dim);
    });

    tx(rows);
  }

  async insertChunks(rows: ChunkRow[], dim: number): Promise<void> {
    if (rows.length === 0) return;
    ensureVecTable(this.db, dim);

    const tx = this.db.transaction((rows: ChunkRow[]) => {
      for (const row of rows) this.insertRow(row, dim);
    });
    tx(rows);
  }

  async deleteByRepository(provider: string, name: string): Promise<void> {
    const tx = this.db.transaction(() => {
      this.deleteAllVecRowsForRepo(provider, name);
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
    const target = resolveVecTable(this.db, provider, name);

    const tx = this.db.transaction(() => {
      if (target) {
        this.db
          .prepare(
            `DELETE FROM ${target}
             WHERE rowid IN (
               SELECT rowid FROM rag_chunks
               WHERE repo_provider = ? AND repo_name = ?
                 AND path IN (${placeholders})
             )`,
          )
          .run(provider, name, ...paths);
      }
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
    const target = resolveVecTable(
      this.db,
      params.repoProvider,
      params.repoName,
    );
    // No metadata = repo never successfully indexed. Legitimate empty.
    if (!target) return [];

    const limit = Math.max(1, Math.floor(params.limit));
    const excludeCount = params.excludePaths?.length ?? 0;
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
      FROM ${target} v
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

  private deleteAllVecRowsForRepo(provider: string, name: string): void {
    const tables = (
      this.db
        .prepare(
          `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name LIKE 'vec_rag_chunks_%'`,
        )
        .all() as Array<{ name: string }>
    ).filter((r) => /^vec_rag_chunks_\d+$/.test(r.name));

    for (const { name: table } of tables) {
      this.db
        .prepare(
          `DELETE FROM ${table}
         WHERE rowid IN (
           SELECT rowid FROM rag_chunks
           WHERE repo_provider = ? AND repo_name = ?
         )`,
        )
        .run(provider, name);
    }
  }
}
