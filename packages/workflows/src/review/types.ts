// packages/workflows/src/review/types.ts

import type { ReviewSignal, RetrievedContext } from "@prsense/core";
import { WorkflowResult } from "../types/core.js";

export type ReviewPayload = {
  signals: ReviewSignal[];
};

export type ReviewWorkflowResult = WorkflowResult<ReviewPayload>;

export type RetrievalWorkflowResult = {
  outcome: "success" | "failure";
  payload?: RetrievedContext;
  error?: string;
};
