// packages/preflight/src/capabilities/schema.ts

import type {
  Capability,
  CapabilityContext,
  CapabilityStatus,
} from "../types.js";

async function hasTables(url: string): Promise<boolean> {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 1000,
  });

  try {
    await client.connect();

    const res = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('rag_chunks', 'prsense_index_metadata')
    `);

    return res.rowCount === 2;
  } finally {
    await client.end().catch(() => {});
  }
}

export const schemaCapability: Capability = {
  id: "schema",
  description: "Database schema is initialized",

  async check(ctx: CapabilityContext): Promise<CapabilityStatus> {
    const db = ctx.config.database;

    if (!db) {
      return {
        kind: "non-applicable",
        reason: "No database configured",
      };
    }

    try {
      const ok = await hasTables(db.url);

      return ok
        ? { kind: "ready" }
        : {
            kind: "missing",
            reason: "Required PRSense tables do not exist",
          };
    } catch {
      return {
        kind: "partial",
        reason: "Database reachable but schema cannot be inspected",
      };
    }
  },

  async apply(ctx: CapabilityContext): Promise<void> {
    const db = ctx.config.database;

    if (!db) {
      throw new Error("No database configured");
    }

    await ensureDatabaseSchema(db.url);
  },
};
