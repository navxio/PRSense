import { UnifiedDiff } from "./Diff.js";
import { RepositoryIdentity } from "../repository/identity.js";
export interface DiffProvider {
  load(): Promise<{
    diff: UnifiedDiff;
    revision: string;
    repositoryIdentity: RepositoryIdentity;
    metadata?: {
      title?: string;
      description?: string;
    };
  }>;
}
