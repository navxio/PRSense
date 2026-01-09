// packages/domain/input/ReviewInput.ts

export type ReviewInput = {
  repo: {
    owner: string;
    name: string;
  };

  /** Raw unified diff text */
  diffText: string;

  /** Optional hints from adapter */
  repoRoot?: string;
  baseBranch?: string;

  /** Human-authored metadata */
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
  };
};
