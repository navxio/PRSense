// packages/workflows/src/index/__tests__/db.ts
import { Client } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const TEST_DB_CONFIG = {
  host: "localhost",
  port: 10001,
  user: "prsense",
  password: "prsense",
  database: "prsense_test",
};

export async function initTestDb() {
  const client = new Client(TEST_DB_CONFIG);
  await client.connect();

  // Load your migration SQL
  const sql = await fs.readFile(
    path.resolve(__dirname, "../../../../context/src/migrations/0001_init.sql"),
    "utf8",
  );

  await client.query(sql);

  await client.end();
}

export async function resetTestDb() {
  const client = new Client(TEST_DB_CONFIG);
  await client.connect();

  await client.query("DELETE FROM rag_chunks");
  await client.query("DELETE FROM prsense_index_metadata");

  await client.end();
}

