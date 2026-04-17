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

export type ExecutionPlan =
  | { kind: "noop" }
  | { kind: "full"; files: string[] }
  | {
    kind: "incremental";
    changedFiles: string[];
    deletedFiles: string[];
    pathsToDelete: string[];
  }
  | {
    kind: "delete-only";
    deletedFiles: string[];
    pathsToDelete: string[];
  };