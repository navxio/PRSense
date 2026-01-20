// apps/daemon/src/jobs/types.ts
export type JobState = "queued" | "running" | "completed" | "failed";

export type JobType = "review" | "index" | "doctor";

export type Job<TInput = unknown, TResult = unknown> = {
  id: string;
  type: JobType;

  state: JobState;

  input: TInput;
  result?: TResult;
  error?: string;

  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};
