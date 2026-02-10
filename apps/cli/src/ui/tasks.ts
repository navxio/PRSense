// apps/cli/src/ui/tasks.ts

export type CliTaskState = "running" | "succeeded" | "failed";

export type CliTask = {
  id: string;
  label: string;
  state: CliTaskState;
};

export interface CliTaskRenderer {
  start(task: CliTask): void;
  update(task: CliTask): void;
  finish(task: CliTask): void;
}
