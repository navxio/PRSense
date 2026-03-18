// packages/workflows/src/review/types.ts

import type { ReviewSignal, RetrievedContext } from "@prsense/core";
import type { LlmUsage } from "@prsense/llm";
import { WorkflowResult } from "../types/core.js";

export type ReviewPayload = {
  signals: ReviewSignal[];
  usage?: LlmUsage;
  diffSummary?: {
    files: string[];
  };
};

export type ReviewWorkflowResult = WorkflowResult<ReviewPayload>;

export type RetrievalWorkflowResult = {
  outcome: "success" | "failure";
  payload?: RetrievedContext;
  error?: string;
};
