// apps/daemon/src/jobs/store.ts
import type { Job } from "./types.js";

export type JobStore = {
  get(id: string): Job | undefined;
  list(): Job[];
  create(job: Job): void;
  update(id: string, patch: Partial<Job>): void;

  track<T>(jobId: string, promise: Promise<T>): Promise<T>;
  drain(): Promise<void>;
};

export function createJobStore(): JobStore {
  const jobs = new Map<string, Job>();
  const inFlight = new Set<Promise<unknown>>();

  return {
    get(id) {
      return jobs.get(id);
    },

    list() {
      return Array.from(jobs.values());
    },

    create(job) {
      jobs.set(job.id, job);
    },

    update(id, patch) {
      const job = jobs.get(id);
      if (!job) return;

      jobs.set(id, { ...job, ...patch });
    },

    async track(jobId, promise) {
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
