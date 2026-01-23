// packages/core/src/ui/task.ts

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
export type TaskDebugEvent =
  | { type: "task:start"; task: Task }
  | { type: "task:update"; taskId: string; label: string }
  | { type: "task:succeed"; taskId: string }
  | { type: "task:fail"; taskId: string; error?: string };

export interface TaskRunner {
  start(task: Task): TaskHandle;
  debug?(event: TaskDebugEvent): void;
}
