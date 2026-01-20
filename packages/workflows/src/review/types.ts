import type { ReviewContext, ReviewSignal } from "@prsense/domain";

import type { WorkflowResult } from "../types/core.js";
export type ReviewWorkflowInput = {
  context: ReviewContext;

  options: {
    confidenceThreshold: number;
    maxSignals: number;
  };
};

export type ReviewPayload = {
  signals: ReviewSignal[];
};

export type ReviewWorkflowResult = WorkflowResult<ReviewPayload>;
