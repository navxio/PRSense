export type DiffHunk = {
  /** Start line in the new file */
  startLine: number;

  /** End line in the new file */
  endLine: number;

  /** Raw hunk text (good enough for v1) */
  content: string;
};

export type DiffFile = {
  /** Path relative to repo root */
  path: string;

  /** Unified diff text */
  patch: string;

  /** Parsed hunks (optional early on) */
  hunks?: DiffHunk[];
};

export type UnifiedDiff = {
  files: DiffFile[];
};
