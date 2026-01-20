import type { IndexDebugEvent } from "./events.js";

export type IndexWorkflowDeps = {
  /**
   * Optional debug event sink.
   * CLI prints them, daemon stores or logs them.
   */
  onDebugEvent?: (event: IndexDebugEvent) => void;

  /**
   * Environment-resolved providers.
   * Workflow does not create these.
   */
  embeddingProvider: unknown;
  vectorStore: unknown;
  repositorySourceFactory: (repoPath: string) => unknown;
};
