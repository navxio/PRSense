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

  WorkflowIndexStarted: "workflow.index.started",
  WorkflowIndexFinished: "workflow.index.finished",
  WorkflowIndexFailed: "workflow.index.failed",
  WorkflowIndexUpToDate: "workflow.index.up_to_date",
  WorkflowIndexOutdated: "workflow.index.outdated",
  WorkflowIndexProgress: "workflow.index.progress",
  WorkflowIndexRebuildRequired: "workflow.index.rebuild.required",
  WorkflowIndexEmbeddingDimensionDetected:
    "workflow.index.embedding_dimension_detected",
  WorkflowIndexDimensionMismatch: "workflow.index.dimension_mismatch",
  WorkflowReviewContextUnavailable: "workflow.review.context_unavailable",
  WorkflowReviewIndexOutdated: "workflow.review.index_outdated",
  WorkflowReviewContextAvailable: "workflow.review.context_available",

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
  ContextFileSkipped: "context.file.skipped",

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
