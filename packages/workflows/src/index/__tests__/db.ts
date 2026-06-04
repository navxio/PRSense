// packages/workflows/src/index/__tests__/db.ts
import {
  openDatabase,
  SqliteRagChunkRepository,
  SqliteIndexMetadataRepository,
  type Db,
} from "@prsense/context";

export interface TestDb {
  db: Db;
  chunkRepo: SqliteRagChunkRepository;
  metadataRepo: SqliteIndexMetadataRepository;

  // Test-facing query helpers — keep the test bodies clean
  chunksAt(path: string): Array<{ content: string; path: string }>;
  countChunksAt(path: string): number;
  allChunks(): Array<{ content: string; path: string }>;
  allPaths(): string[];
  close(): void;
}

export function createTestDb(): TestDb {
  const db = openDatabase(":memory:");
  const chunkRepo = new SqliteRagChunkRepository(db);
  const metadataRepo = new SqliteIndexMetadataRepository(db);

  return {
    db,
    chunkRepo,
    metadataRepo,

    chunksAt(path: string) {
      return db
        .prepare(`SELECT content, path FROM rag_chunks WHERE path = ?`)
        .all(path) as Array<{ content: string; path: string }>;
    },

    countChunksAt(path: string) {
      const row = db
        .prepare(`SELECT COUNT(*) as n FROM rag_chunks WHERE path = ?`)
        .get(path) as { n: number };
      return row.n;
    },

    allChunks() {
      return db.prepare(`SELECT content, path FROM rag_chunks`).all() as Array<{
        content: string;
        path: string;
      }>;
    },

    allPaths() {
      return (
        db.prepare(`SELECT path FROM rag_chunks`).all() as Array<{
          path: string;
        }>
      ).map((r) => r.path);
    },

    close() {
      db.close();
    },
  };
}
