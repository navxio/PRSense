import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";

import { bootstrapDaemon } from "./bootstrap.js";
import { createDaemonLogger } from "./logger.js";
import { createJobStore } from "./jobs/store.js";
import { registerJobRoutes } from "./http/jobs.js";
import { registerHealthRoutes } from "./http/health.js";
import { setupGracefulShutdown } from "./shutdown.js";
import { registerGitHubWebhook } from "./http/webhooks/github.js";
import { registerGitLabWebhook } from "./http/webhooks/gitlab.js";
import { createDeliveryRegistry } from "./idempotency/deliveryRegistry.js";

const deliveryRegistry = createDeliveryRegistry();

async function main() {
  const logger = createDaemonLogger();
  const { config, credentials } = bootstrapDaemon();

  logger.info("daemon.starting", {
    mode: config.mode,
    llm: config.llm.provider,
    embeddings: config.embeddings.provider,
  });

  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 }); // use our logger instead

  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
  });

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
  registerJobRoutes(app, jobStore, config, credentials, logger);
  registerGitHubWebhook(
    app,
    jobStore,
    config,
    credentials,
    logger,
    deliveryRegistry,
  );
  registerGitLabWebhook(
    app,
    jobStore,
    config,
    credentials,
    logger,
    deliveryRegistry,
  );

  const port = parseInt(process.env.PRSENSE_DAEMON_PORT ?? "11000");
  await app.listen({ port: port });

  console.log(`Daemon listening on port ${port}`);

  logger.info("daemon.started", { port });
}

main().catch((err) => {
  console.error("Daemon startup failed:", err);
  process.exit(1);
});
