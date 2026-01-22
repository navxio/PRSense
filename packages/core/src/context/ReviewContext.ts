import { UnifiedDiff } from "../diff/Diff.js";

export type ReviewContext = {
  /** Absolute repo root */
  repoRoot: string;

  /** Branch being compared against */
  baseBranch: string;

  /** Unified diff for this review */
  diff: UnifiedDiff;

  /** Optional metadata */
  metadata?: {
    language?: string;
    isMonorepo?: boolean;
  };
};
