// apps/daemon/src/index.ts
import Fastify from "fastify";

import { createJobStore } from "./jobs/store.js";
import { registerRoutes } from "./http/routes.js";

const app = Fastify({ logger: true });

const jobStore = createJobStore();

registerRoutes(app, jobStore);

await app.listen({ port: 3000 });
