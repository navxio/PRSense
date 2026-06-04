// packages/context/src/db/SqliteDatabase.ts
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rag_chunks (
  rowid         INTEGER PRIMARY KEY,           -- joins to vec_rag_chunks.rowid
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

/**
 * Opens (or creates) the PRSense SQLite database, configures it for
 * single-writer concurrent reads, loads sqlite-vec, and ensures schema.
 *
 * The vec0 virtual table is created with the embedding dimension, so we
 * create it lazily on first use (see ensureVecTable) rather than here —
 * dimension isn't known until the embedding provider is configured.
 */
export function openDatabase(path: string): Db {
  const db = new Database(path);

  // WAL: concurrent readers while a single writer holds the lock.
  db.pragma("journal_mode = WAL");
  // NORMAL is the recommended durability/speed tradeoff under WAL.
  db.pragma("synchronous = NORMAL");
  // Wait up to 5s for the write lock instead of throwing SQLITE_BUSY.
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  sqliteVec.load(db);

  db.exec(SCHEMA);

  return db;
}

/**
 * Creates the vec0 virtual table for embeddings if it doesn't exist.
 * Idempotent. Dimension is fixed at creation — if you change embedding
 * models with a different dimension, the table must be dropped/rebuilt
 * (the metadata repo's dimension field is how you detect that).
 */
export function ensureVecTable(db: Db, dimension: number): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_rag_chunks USING vec0(
      embedding float[${dimension}]
    );
  `);
}

/** Reads the dimension the vec table was created with, or null if absent. */
export function getVecDimension(db: Db): number | null {
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
