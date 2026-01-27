// packages/core/src/events.ts

/**
 * Canonical domain events.
 * These describe meaningful system facts.
 */
export const CoreEvents = {
  RunStarted: "run.started",
  RunFinished: "run.finished",
  RunFailed: "run.failed",

  WorkflowReviewStarted: "workflow.review.started",
  WorkflowReviewFinished: "workflow.review.finished",
  WorkflowReviewFailed: "workflow.review.failed",

  ContextDiffLoaded: "context.diff.loaded",
  ContextChunksBuilt: "context.chunks.built",
  ContextTruncated: "context.truncated",

  EngineSignalsCompiled: "engine.signals.compiled",
  EngineSignalDiscarded: "engine.signal.discarded",
} as const;

export type CoreEventName = (typeof CoreEvents)[keyof typeof CoreEvents];
