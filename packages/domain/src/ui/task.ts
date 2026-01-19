// packages/domain/src/ui/task.ts

export type TaskStatus = "idle" | "running" | "succeeded" | "failed";

export interface Task {
  readonly id: string;
  readonly label: string;
}

export interface TaskHandle {
  update(label: string): void;
  succeed(label?: string): void;
  fail(label?: string): void;
}

export interface TaskRunner {
  start(task: Task): TaskHandle;
}
