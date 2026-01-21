// apps/daemon/src/jobs/runJob.ts
import type { JobStore } from "./store.js";

export async function runJob<TResult>(
  store: JobStore,
  jobId: string,
  fn: () => Promise<TResult>,
) {
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
  } catch (err) {
    store.update(jobId, {
      state: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
      finishedAt: Date.now(),
    });
  }
}
