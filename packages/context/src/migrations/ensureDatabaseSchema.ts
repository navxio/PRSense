import pg from "pg";
import { loadMigrationSql } from "./loadSql.js";

const { Client } = pg;

async function tableExists(client: pg.Client, table: string) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = $1
    );
  `,
    [table],
  );

  return result.rows[0]?.exists === true;
}

export async function ensureDatabaseSchema(databaseUrl: string): Promise<void> {
  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  try {
    // 1️⃣ Ensure pgvector extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2️⃣ Check if main table exists
    const exists = await tableExists(client, "rag_chunks");

    if (!exists) {
      const sql = loadMigrationSql("0001_init.sql");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}
