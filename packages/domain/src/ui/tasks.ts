// packages/domain/src/ui/tasks.ts

import { Task } from "./task.js";

export const Tasks = {
  readDiff(): Task {
    return { id: "read-diff", label: "Reading git diff" };
  },

  buildContext(): Task {
    return { id: "build-context", label: "Building code context" };
  },

  queryLLM(model: string): Task {
    return {
      id: "query-llm",
      label: `Querying LLM (${model})`,
    };
  },

  compileSignals(): Task {
    return { id: "compile-signals", label: "Compiling review signals" };
  },

  indexScan(): Task {
    return { id: "index-scan", label: "Scanning repository" };
  },
} as const;
