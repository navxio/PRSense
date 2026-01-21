// apps/daemon/src/http/doctor.ts
import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";

import type { JobStore } from "../jobs/store.js";
import { runJob } from "../jobs/runJob.js";
import { runDoctorJob } from "../jobs/doctor/runDoctorJob.js";

export function registerDoctorRoutes(app: FastifyInstance, store: JobStore) {
  app.post("/jobs/doctor", async (req, reply) => {
    const jobId = randomUUID();

    store.create({
      id: jobId,
      type: "doctor",
      state: "queued",
      input: {},
      createdAt: Date.now(),
    });

    // fire and forget
    runJob(store, jobId, async () => {
      return runDoctorJob();
    });

    return { jobId };
  });
}
