import type { Job } from "./types.js";
import type { Logger } from "@prsense/logging";

export function createJobStore(logger: Logger) {
  const jobs = new Map<string, Job>();
  const inFlight = new Set<Promise<unknown>>();

  return {
    get(id: string) {
      return jobs.get(id);
    },

    list() {
      return Array.from(jobs.values());
    },

    create(job: Job) {
      jobs.set(job.id, job);

      logger.info("job.queued", {
        jobId: job.id,
        type: job.type,
      });
    },

    update(id: string, patch: Partial<Job>) {
      const job = jobs.get(id);
      if (!job) return;

      const updated = { ...job, ...patch };
      jobs.set(id, updated);

      if (patch.state === "running") {
        logger.info("job.started", { jobId: id });
      }

      if (patch.state === "completed") {
        logger.info("job.completed", {
          jobId: id,
          duration:
            updated.finishedAt && updated.startedAt
              ? updated.finishedAt - updated.startedAt
              : undefined,
        });
      }

      if (patch.state === "failed") {
        logger.error("job.failed", {
          jobId: id,
          error: patch.error,
        });
      }
    },

    async track(jobId: string, promise: Promise<unknown>) {
      inFlight.add(promise);
      try {
        return await promise;
      } finally {
        inFlight.delete(promise);
      }
    },

    async drain() {
      await Promise.allSettled(Array.from(inFlight));
    },
  };
}

export type JobStore = ReturnType<typeof createJobStore>;
