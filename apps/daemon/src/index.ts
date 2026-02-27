import Fastify from "fastify";

import { bootstrapDaemon } from "./bootstrap.js";
import { createDaemonLogger } from "./logger.js";
import { createJobStore } from "./jobs/store.js";
import { registerRoutes } from "./http/routes.js";
import { registerHealthRoutes } from "./http/health.js";
import { setupGracefulShutdown } from "./shutdown.js";

async function main() {
  const logger = createDaemonLogger();
  const { config, credentials } = bootstrapDaemon();

  logger.info("daemon.starting", {
    mode: config.mode,
    llm: config.llm.provider,
    embeddings: config.embeddings.provider,
  });

  const app = Fastify({ logger: false }); // use our logger instead

  const jobStore = createJobStore(logger);

  setupGracefulShutdown({
    closeHttp: async () => {
      logger.info("daemon.http.closing");
      await app.close();
    },
    onShutdown: async () => {
      logger.info("daemon.draining.jobs");
      await jobStore.drain();
    },
  });

  registerHealthRoutes(app, logger, config);
  registerRoutes(app, jobStore, config, credentials, logger);

  await app.listen({ port: 3000 });

  logger.info("daemon.started", { port: 3000 });
}

main().catch((err) => {
  console.error("Daemon startup failed:", err);
  process.exit(1);
});
