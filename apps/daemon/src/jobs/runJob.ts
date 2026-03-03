import type { JobStore } from "./store.js";
import type { Logger } from "@prsense/logging";

export async function runJob<TResult>(
  store: JobStore,
  logger: Logger,
  jobId: string,
  fn: () => Promise<TResult>,
) {
  const promise = (async () => {
    logger.info("job.execution.started", { jobId });
    store.update(jobId, {
      state: "running",
      startedAt: Date.now(),
    });

    try {
      const result = await fn();

      store.update(jobId, {
        state: "completed",
        result,
        finishedAt: Date.now(),
      });

      logger.info("job.execution.completed", { jobId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      store.update(jobId, {
        state: "failed",
        error: message,
        finishedAt: Date.now(),
      });

      logger.error("job.execution.failed", {
        jobId,
        error: message,
      });

      throw err;
    }
  })();

  return store.track(jobId, promise);
}
