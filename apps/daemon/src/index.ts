// apps/daemon/src/index.ts
import Fastify from "fastify";

import { createJobStore } from "./jobs/store.js";
import { registerRoutes } from "./http/routes.js";
import { registerDoctorRoutes } from "./http/doctor.js";
import { setupGracefulShutdown } from "./shutdown.js";

const app = Fastify({ logger: true });
const jobStore = createJobStore();

setupGracefulShutdown({
  closeHttp: async () => {
    await app.close();
  },
  onShutdown: async () => {
    console.log("Draining in-flight jobs...");
    await jobStore.drain();
  },
});

registerRoutes(app, jobStore);
registerDoctorRoutes(app, jobStore);

await app.listen({ port: 3000 });
