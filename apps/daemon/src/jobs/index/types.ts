// apps/daemon/src/jobs/index/types.ts
import type { IndexWorkflowResult } from "@prsense/workflows";

export type IndexJobInput = {
  target: string;
  force?: boolean;
  dryRun?: boolean;
};

export type IndexJobResult = IndexWorkflowResult;
