// packages/core/src/ui/tasks.ts

import { Task } from "./task.js";

export const Tasks = {
  loadConfig(): Task {
    return { id: "load-config", label: "Loading configuration" };
  },

  selectAdapter(): Task {
    return { id: "select-adapter", label: "Selecting diff source" };
  },

  ingestDiff(): Task {
    return { id: "ingest-diff", label: "Ingesting diff" };
  },

  buildContext(): Task {
    return { id: "build-context", label: "Building review context" };
  },

  runReviewEngine(): Task {
    return { id: "run-review", label: "Running review engine" };
  },

  compileSignals(): Task {
    return { id: "compile-signals", label: "Compiling review signals" };
  },
} as const;
