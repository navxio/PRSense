import { UnifiedDiff } from "./Diff.js";
export interface DiffProvider {
  load(): Promise<{
    diff: UnifiedDiff;
    revision: string;
    repositoryIdentity: {
      provider: string;
      id: string;
    };
  }>;
}
