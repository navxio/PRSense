// apps/daemon/src/jobs/review/types.ts
import type { ReviewWorkflowResult } from "@prsense/workflows";

export type ReviewJobInput = {
  target: string; // path or PR/MR URL
  baseBranch?: string;
};

export type ReviewJobResult = ReviewWorkflowResult;
