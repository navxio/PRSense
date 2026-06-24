// packages/workflows/src/review/steps/loadDiff.ts

import type { DiffProvider } from "@prsense/core";

export async function loadDiff(diffProvider: DiffProvider) {
  const { diff, revision, repositoryIdentity, metadata, baseRevision } =
    await diffProvider.load();

  const diffSummary = {
    files: diff.files.map((f) => f.path),
  };

  return {
    diff,
    revision,
    repositoryIdentity,
    metadata,
    diffSummary,
    baseRevision,
  };
}
