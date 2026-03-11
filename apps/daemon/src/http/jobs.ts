import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";

import type { JobStore } from "../jobs/store.js";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import type { Logger } from "@prsense/logging";

import { runJob } from "../jobs/runJob.js";
import { runIndexJob } from "../jobs/index/runIndexJob.js";
import { runReviewJob } from "../jobs/review/runReviewJob.js";

export function registerJobRoutes(
  app: FastifyInstance,
  store: JobStore,
  config: ResolvedConfig,
  credentials: CredentialContext,
  logger: Logger,
) {
  /* ----------------------------- */
  /* INDEX JOB                     */
  /* ----------------------------- */

  app.post("/jobs/index", async (req, reply) => {
    const body = req.body as {
      target: string;
      force?: boolean;
      dryRun?: boolean;
    };

    if (!body?.target) {
      reply.status(400);
      return { error: "target is required" };
    }

    const jobId = randomUUID();

    store.create({
      id: jobId,
      type: "index",
      state: "queued",
      input: body,
      createdAt: Date.now(),
    });

    runJob(store, logger, jobId, async () =>
      runIndexJob(body, config, credentials, logger),
    );

    return { jobId };
  });

  /* ----------------------------- */
  /* REVIEW JOB                    */
  /* ----------------------------- */

  app.post("/jobs/review", async (req, reply) => {
    const body = req.body as {
      target: string;
      baseBranch?: string;
    };

    if (!body?.target) {
      reply.status(400);
      return { error: "target is required" };
    }

    const jobId = randomUUID();

    store.create({
      id: jobId,
      type: "review",
      state: "queued",
      input: body,
      createdAt: Date.now(),
    });

    runJob(store, logger, jobId, async () =>
      runReviewJob(body, config, credentials, logger),
    );

    return { jobId };
  });

  /* ----------------------------- */
  /* JOB STATUS                    */
  /* ----------------------------- */

  app.get("/jobs/:id", async (req, reply) => {
    const id = (req.params as any).id;

    const job = store.get(id);

    if (!job) {
      reply.status(404);
      return { error: "Job not found" };
    }

    return job;
  });

  /* ----------------------------- */
  /* LIST JOBS                     */
  /* ----------------------------- */

  app.get("/jobs", async () => {
    return store.list();
  });
}
