// packages/preflight/src/capabilities/pgvector.ts
import pg from "pg";
import type {
  Capability,
  CapabilityContext,
  CapabilityStatus,
} from "../types.js";

async function hasVectorExtension(url: string): Promise<boolean> {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 1_000,
  });

  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_extension WHERE extname = 'vector'",
    );
    return res.rowCount === 1;
  } finally {
    await client.end().catch(() => {});
  }
}

async function installVectorExtension(url: string): Promise<void> {
  const client = new pg.Client({
    connectionString: url,
  });

  try {
    await client.connect();
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  } finally {
    await client.end().catch(() => {});
  }
}

export const pgVectorCapability: Capability = {
  id: "pgvector",
  description: "pgvector extension is installed",

  async check(ctx: CapabilityContext): Promise<CapabilityStatus> {
    const db = ctx.config.database;

    // 1️⃣ No database configured → not applicable
    if (!db) {
      return {
        kind: "non-applicable",
        reason: "No database configured",
      };
    }

    // 2️⃣ Try to inspect pgvector
    try {
      const exists = await hasVectorExtension(db.url);
      return exists
        ? { kind: "ready" }
        : {
            kind: "missing",
            reason: "pgvector extension is not installed",
          };
    } catch {
      // Connection / permission / dependency failure
      return {
        kind: "partial",
        reason:
          "Postgres is not reachable or pgvector extension cannot be inspected",
      };
    }
  },

  async apply(ctx: CapabilityContext): Promise<void> {
    const db = ctx.config.database;

    if (!db) {
      throw new Error("No database configured");
    }

    if (db.mode === "external") {
      throw new Error(
        "pgvector must be installed manually for external Postgres",
      );
    }

    await installVectorExtension(db.url);
  },
};
