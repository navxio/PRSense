import type { TaskRunner } from "@prsense/domain";

export type WorkflowDeps = {
  /**
   * Optional task runner for progress reporting.
   * CLI provides one, daemon may provide another or none.
   */
  ui?: TaskRunner;
};
