// packages/context/src/db/SqliteDatabase.ts
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rag_chunks (
  rowid         INTEGER PRIMARY KEY,           -- joins to vec_rag_chunks_<dim>.rowid
  id            TEXT NOT NULL UNIQUE,
  repo_provider TEXT NOT NULL,
  repo_owner    TEXT,
  repo_name     TEXT NOT NULL,
  repo_ref      TEXT,
  path          TEXT NOT NULL,
  kind          TEXT NOT NULL,
  language      TEXT,
  content       TEXT NOT NULL,
  line_start    INTEGER,
  line_end      INTEGER,
  indexed_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_repo
  ON rag_chunks (repo_provider, repo_name, repo_ref);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_path
  ON rag_chunks (repo_provider, repo_name, path);

CREATE TABLE IF NOT EXISTS prsense_index_metadata (
  repository_provider TEXT NOT NULL,
  repository_id       TEXT NOT NULL,
  commit_sha          TEXT NOT NULL,
  embedding_provider  TEXT NOT NULL,
  embedding_model     TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  chunk_strategy      TEXT NOT NULL,
  chunk_version       INTEGER NOT NULL,
  prsense_version     TEXT NOT NULL,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (repository_provider, repository_id)
);
`;

/** Name of the vec0 table for a given dimension. */
export function vecTableName(dimension: number): string {
  return `vec_rag_chunks_${dimension}`;
}

/**
 * Opens (or creates) the PRSense SQLite database, configures it for
 * single-writer concurrent reads, loads sqlite-vec, and ensures schema.
 *
 * Vec tables are dimension-scoped (`vec_rag_chunks_<dim>`) so a single
 * database can hold repositories indexed under different embedding
 * providers / dimensions. Tables are created lazily by ensureVecTable.
 */
export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);
  db.exec(SCHEMA);
  migrateLegacyVecTable(db);
  return db;
}

function migrateLegacyVecTable(db: Db): void {
  const legacy = db
    .prepare(
      `SELECT 1 FROM sqlite_master
       WHERE type = 'table' AND name = 'vec_rag_chunks'`,
    )
    .get();
  if (!legacy) return;

  // vec0 virtual tables can't be safely renamed — ALTER doesn't touch
  // their shadow tables (_rowids, _chunks, _info), which leaves the
  // module looking for tables that no longer match. Drop + reindex is
  // the only safe path. DROP TABLE on a vec0 virtual table cleans up
  // its shadows correctly.
  db.exec(`
    DROP TABLE vec_rag_chunks;
    DELETE FROM rag_chunks;
    DELETE FROM prsense_index_metadata;
  `);
}

/**
 * Creates the vec0 virtual table for the given dimension if missing.
 * Purely additive — never drops. Existing tables for other dimensions
 * are left alone, so multiple repos at different dimensions coexist.
 */
export function ensureVecTable(db: Db, dimension: number): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${vecTableName(dimension)} USING vec0(
      embedding float[${dimension}]
    );
  `);
}

/**
 * Reads the dimension of the pre-0.16 single vec table, if present.
 * Returns null once the migration has run.
 */
function getLegacyVecDimension(db: Db): number | null {
  const row = db
    .prepare(
      `SELECT sql FROM sqlite_master
       WHERE type = 'table' AND name = 'vec_rag_chunks'`,
    )
    .get() as { sql: string } | undefined;
  if (!row) return null;
  const m = row.sql.match(/float\[(\d+)\]/);
  return m ? Number(m[1]) : null;
}

/**
 * Resolves the vec table name for a repository by reading its
 * recorded embedding dimension from prsense_index_metadata.
 *
 * Returns null when the repository has no metadata row — i.e. it
 * was never successfully indexed. Callers should treat this as
 * "nothing to do" (no chunks exist, no vec table to query).
 */
export function resolveVecTable(
  db: Db,
  provider: string,
  id: string,
): string | null {
  const row = db
    .prepare(
      `SELECT embedding_dimension FROM prsense_index_metadata
       WHERE repository_provider = ? AND repository_id = ?`,
    )
    .get(provider, id) as { embedding_dimension: number } | undefined;
  if (!row) return null;
  return vecTableName(row.embedding_dimension);
}
