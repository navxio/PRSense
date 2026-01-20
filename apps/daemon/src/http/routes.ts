// apps/daemon/src/http/routes.ts
import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";

import type { JobStore } from "../jobs/store.js";
import { runJob } from "../jobs/runJob.js";

export function registerRoutes(app: FastifyInstance, store: JobStore) {
  app.post("/jobs", async (req, reply) => {
    const jobId = randomUUID();

    store.create({
      id: jobId,
      type: "review",
      state: "queued",
      input: req.body,
      createdAt: Date.now(),
    });

    // Temporary fake execution
    runJob(store, jobId, async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return { ok: true };
    });

    return { jobId };
  });

  app.get("/jobs/:id", async (req, reply) => {
    const job = store.get(req.params.id);
    if (!job) {
      reply.code(404);
      return { error: "Job not found" };
    }
    return job;
  });
}
