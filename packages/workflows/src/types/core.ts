import type { Task } from "@prsense/domain";

/**
 * High-level outcome of a workflow.
 * This is NOT presentation and NOT process exit.
 */
export type WorkflowOutcome = "success" | "failure";

/**
 * Base shape returned by all workflows.
 */
export type WorkflowResult<TPayload> = {
  outcome: WorkflowOutcome;

  /**
   * Structured payload produced by the workflow.
   * Interpretation is workflow-specific.
   */
  payload: TPayload;
};
