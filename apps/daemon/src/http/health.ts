import type { FastifyInstance } from "fastify";
import type { Logger } from "@prsense/logging";
import type { ResolvedConfig } from "@prsense/runtime-config";
import pg from "pg";

export function registerHealthRoutes(
  app: FastifyInstance,
  logger: Logger,
  config: ResolvedConfig,
) {
  app.get("/health", async () => {
    logger.debug("health.check");
    return { status: "ok" };
  });

  app.get("/ready", async (_, reply) => {
    try {
      const client = new pg.Client({
        connectionString: config.database.url,
      });

      await client.connect();
      await client.end();

      return { ready: true };
    } catch (err) {
      logger.error("readiness.failed", { err });
      reply.status(503);
      return { ready: false };
    }
  });
}
