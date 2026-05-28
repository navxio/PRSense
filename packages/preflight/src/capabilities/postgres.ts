// packages/preflight/src/capabilities/postgres.ts
import { execSync } from "node:child_process";
import pg from "pg";
import type {
  Capability,
  CapabilityContext,
  CapabilityStatus,
} from "../types.js";

const CONTAINER_NAME = "prsense_postgres";

async function canConnect(url: string): Promise<boolean> {
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 1_000,
  });

  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

function containerExists(): boolean {
  try {
    execSync(`docker inspect ${CONTAINER_NAME}`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function containerRunning(): boolean {
  try {
    const status = execSync(
      `docker inspect -f "{{.State.Running}}" ${CONTAINER_NAME}`,
      { encoding: "utf8" },
    ).trim();

    return status === "true";
  } catch {
    return false;
  }
}

export const postgresCapability: Capability = {
  id: "postgres",
  description: "Postgres is reachable",

  async check(ctx: CapabilityContext): Promise<CapabilityStatus> {
    const db = ctx.config.database;

    if (!db) {
      return {
        kind: "missing",
        reason: "Database configuration not provided",
      };
    }

    // External/self-hosted DB
    if (db.mode === "external") {
      const ok = await canConnect(db.url);
      return ok
        ? { kind: "ready" }
        : {
            kind: "missing",
            reason: "Cannot connect to external Postgres",
          };
    }

    // Docker-managed DB
    if (!containerExists()) {
      return {
        kind: "missing",
        reason: "Postgres container does not exist",
      };
    }

    if (!containerRunning()) {
      return {
        kind: "missing",
        reason: "Postgres container exists but is not running",
      };
    }

    const ok = await canConnect(db.url);
    return ok
      ? { kind: "ready" }
      : {
          kind: "partial",
          reason: "Postgres container is running but not accepting connections",
        };
  },

  async apply(ctx: CapabilityContext): Promise<void> {
    const db = ctx.config.database;

    if (!db) {
      throw new Error("Database configuration not provided");
    }

    if (db.mode === "external") {
      throw new Error("External Postgres must be provisioned manually");
    }

    try {
      execSync(
        `
docker run -d \
  --name ${CONTAINER_NAME} \
  -e POSTGRES_USER=prsense \
  -e POSTGRES_PASSWORD=prsense \
  -e POSTGRES_DB=prsense \
  -p 10000:5432 \
  -v prsense_pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  ankane/pgvector:latest
        `,
        { stdio: "inherit" },
      );
    } catch {
      throw new Error("Failed to start Postgres container. Is Docker running?");
    }
  },
};
