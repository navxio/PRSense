import pg from "pg";
import type {
  Capability,
  CapabilityContext,
  CapabilityStatus,
} from "./types.js";

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
  } catch {
    // Connection or permission issue will be handled by caller
    throw new Error("Failed to inspect pgvector extension");
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
    const db = ctx.database;

    if (!db) {
      return {
        kind: "missing",
        reason: "Database configuration not provided",
      };
    }

    try {
      const exists = await hasVectorExtension(db.url);
      return exists
        ? { kind: "ready" }
        : {
            kind: "missing",
            reason: "pgvector extension is not installed",
          };
    } catch {
      return {
        kind: "partial",
        reason:
          "Unable to inspect pgvector extension (permission or connection issue)",
      };
    }
  },

  async apply(ctx: CapabilityContext): Promise<void> {
    const db = ctx.database;

    if (!db) {
      throw new Error("Database configuration not provided");
    }

    if (db.mode === "external") {
      throw new Error(
        "pgvector must be installed manually for external Postgres",
      );
    }

    await installVectorExtension(db.url);
  },
};
