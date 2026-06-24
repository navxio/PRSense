// packages/core/src/diff/DiffProvider.ts
import { UnifiedDiff } from "./Diff.js";
import { RepositoryIdentity } from "../repository/identity.js";
export interface DiffProvider {
  load(): Promise<{
    diff: UnifiedDiff;
    revision: string;
    baseRevision: string;
    repositoryIdentity: RepositoryIdentity;
    metadata?: {
      title?: string;
      description?: string;
      branchName?: string;
    };
  }>;
}
