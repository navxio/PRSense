// apps/daemon/src/jobs/review/types.ts
export type ReviewJobInput = {
  target: string; // local path OR PR/MR URL
  baseBranch?: string;
};
