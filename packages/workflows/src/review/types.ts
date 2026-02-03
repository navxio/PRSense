// packages/workflows/src/review/types.ts

import type { ReviewSignal } from "@prsense/core";
import { WorkflowResult } from "../types/core.js";

export type ReviewPayload = {
  signals: ReviewSignal[];
};

export type ReviewWorkflowResult = WorkflowResult<ReviewPayload>;
