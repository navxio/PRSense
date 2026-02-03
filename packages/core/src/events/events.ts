// packages/core/src/events/events.ts

/**
 * Canonical domain events.
 * These describe meaningful system facts.
 */
export const CoreEvents = {
  /* -------------------------------------------------
   * Run lifecycle (top-level invocation)
   * ------------------------------------------------- */
  RunStarted: "run.started",
  RunFinished: "run.finished",
  RunFailed: "run.failed",

  /* -------------------------------------------------
   * Workflow lifecycle
   * ------------------------------------------------- */
  WorkflowDoctorStarted: "workflow.doctor.started",
  WorkflowDoctorFinished: "workflow.doctor.finished",
  WorkflowDoctorFailed: "workflow.doctor.failed",

  WorkflowSetupStarted: "workflow.setup.started",
  WorkflowSetupFinished: "workflow.setup.finished",
  WorkflowSetupFailed: "workflow.setup.failed",

  WorkflowReviewStarted: "workflow.review.started",
  WorkflowReviewFinished: "workflow.review.finished",
  WorkflowReviewFailed: "workflow.review.failed",

  /* -------------------------------------------------
   * Capability lifecycle
   * ------------------------------------------------- */
  CapabilityCheckStarted: "capability.check.started",
  CapabilityCheckFinished: "capability.check.finished",

  CapabilityApplyStarted: "capability.apply.started",
  CapabilityApplyFinished: "capability.apply.finished",
  CapabilityApplyFailed: "capability.apply.failed",

  /* -------------------------------------------------
   * Context lifecycle
   * ------------------------------------------------- */
  ContextDiffLoaded: "context.diff.loaded",
  ContextChunksBuilt: "context.chunks.built",
  ContextTruncated: "context.truncated",

  /* -------------------------------------------------
   * Signal lifecycle (domain findings)
   * ------------------------------------------------- */
  SignalCompiled: "signal.compiled",
  SignalDiscarded: "signal.discarded",

  /* -------------------------------------------------
   * Task lifecycle (UI / progress views)
   * ------------------------------------------------- */
  TaskStarted: "task.started",
  TaskUpdated: "task.updated",
  TaskSucceeded: "task.succeeded",
  TaskFailed: "task.failed",
} as const;

export type CoreEventName = (typeof CoreEvents)[keyof typeof CoreEvents];
