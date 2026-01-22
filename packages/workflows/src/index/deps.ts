// packages/workflows/src/index/deps.ts
import type { IndexDebugEvent } from "./events.js";

export type IndexWorkflowDeps = {
  repositorySourceFactory: (repoPath: string) => unknown;
  embeddingProvider: unknown;
  vectorStore: unknown;

  onDebugEvent?: (event: IndexDebugEvent) => void;
};
