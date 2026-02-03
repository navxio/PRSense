// packages/workflows/src/index/types.ts

import { WorkflowResult } from "../types/core.js";

export type IndexPayload = {
  chunksIndexed: number;
};

export type IndexWorkflowResult = WorkflowResult<IndexPayload>;
