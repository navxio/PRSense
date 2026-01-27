// packages/llm/src/events.ts

export const LlmEvents = {
  RequestStarted: "llm.request.started",
  RequestSucceeded: "llm.request.succeeded",
  RequestFailed: "llm.request.failed",
  RequestRetried: "llm.request.retried",
  RequestTimedOut: "llm.request.timed_out",
} as const;

export type LlmEventName = (typeof LlmEvents)[keyof typeof LlmEvents];
