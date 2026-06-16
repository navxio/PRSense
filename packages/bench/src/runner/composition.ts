// packages/bench/src/runner/composition.ts
import { mkdirSync } from "node:fs";
import {
  openDatabase,
  SqliteRagChunkRepository,
  SqliteIndexMetadataRepository,
  type Db,
} from "@prsense/context";
import { DB_PATH, PRSENSE_DATA_DIR } from "@prsense/core";

export interface Services {
  db: Db;
  chunkRepo: SqliteRagChunkRepository;
  metadataRepo: SqliteIndexMetadataRepository;
  close: () => void;
}

export function buildServices(): Services {
  mkdirSync(PRSENSE_DATA_DIR, { recursive: true });
  const db = openDatabase(DB_PATH);

  return {
    db,
    chunkRepo: new SqliteRagChunkRepository(db),
    metadataRepo: new SqliteIndexMetadataRepository(db),
    close: () => db.close(),
  };
}
