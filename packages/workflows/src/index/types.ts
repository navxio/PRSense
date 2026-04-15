// packages/workflows/src/index/types.ts

import { WorkflowResult } from "../types/core.js";

export type IndexPayload = {
  chunksIndexed: number;
  commitSha?: string;
  upToDate?: boolean;
  summary?: {
    filesChanged?: number;
    filesDeleted?: number;
    deleteAll?: boolean;
  }
};

export type IndexWorkflowResult = WorkflowResult<IndexPayload>;

export type IndexPlan =
  | { type: "noop" }
  | { type: "full" }
  | { type: "incremental"; baseSha: string; targetSha: string };
