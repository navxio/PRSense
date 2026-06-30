// packages/context/src/db/SqliteDatabase.test.ts
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { openDatabase } from "./SqliteDatabase.js";

describe("Legacy vec table migration", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "prsense-mig-")),
      "test.db",
    );
  });

  afterEach(() => {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it("drops legacy vec_rag_chunks and clears chunks + metadata on open", async () => {
    // Simulate a pre-0.16 DB: single global vec_rag_chunks, some chunks,
    // some metadata.
    {
      const db = openDatabase(dbPath);
      // Simulate pre-0.16: replace the dim-scoped vec table with the legacy form.
      db.exec(`
    DROP TABLE IF EXISTS vec_rag_chunks_768;
    CREATE VIRTUAL TABLE vec_rag_chunks USING vec0(embedding float[768]);
    INSERT INTO rag_chunks (id, repo_provider, repo_name, path, kind, content)
    VALUES ('chunk1', 'local', 'repo', 'a.txt', 'code', 'content');
    INSERT INTO prsense_index_metadata (
      repository_provider, repository_id, commit_sha,
      embedding_provider, embedding_model, embedding_dimension,
      chunk_strategy, chunk_version, prsense_version
    ) VALUES (
      'local', 'repo', 'abc123',
      'ollama', 'nomic-embed-text', 768,
      'composite', 1, '0.15.1'
    );
  `);
      db.close();
    }

    // Reopen via openDatabase — migration should fire.
    const db = openDatabase(dbPath);

    const legacy = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'vec_rag_chunks'`,
      )
      .get();
    const chunkCount = db
      .prepare(`SELECT COUNT(*) AS n FROM rag_chunks`)
      .get() as { n: number };
    const metaCount = db
      .prepare(`SELECT COUNT(*) AS n FROM prsense_index_metadata`)
      .get() as { n: number };

    expect(legacy).toBeUndefined();
    expect(chunkCount.n).toBe(0);
    expect(metaCount.n).toBe(0);

    db.close();
  });

  it("is a no-op on fresh databases", async () => {
    // Just opening a fresh DB shouldn't throw or wipe anything.
    const db = openDatabase(dbPath);
    const chunkCount = db
      .prepare(`SELECT COUNT(*) AS n FROM rag_chunks`)
      .get() as { n: number };
    expect(chunkCount.n).toBe(0);
    db.close();
  });
});
