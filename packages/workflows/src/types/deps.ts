import type { TaskRunner } from "@prsense/core";

export type WorkflowDeps = {
  /**
   * Optional task runner for progress reporting.
   * CLI provides one, daemon may provide another or none.
   */
  ui?: TaskRunner;
};
