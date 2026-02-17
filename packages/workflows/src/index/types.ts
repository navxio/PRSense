// packages/workflows/src/index/types.ts

import { WorkflowResult } from "../types/core.js";

export type IndexPayload = {
  chunksIndexed: number;
  commitSha?: string;
  upToDate?: boolean;
};

export type IndexWorkflowResult = WorkflowResult<IndexPayload>;
