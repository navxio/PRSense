// packages/core/src/context/ContextProvider.ts
import type { UnifiedDiff, DiffFile } from "../diff/Diff.js";
import type { ContextChunk } from "./index.js";
import type { EventBus } from "../events/types.js";
import type { RepositoryIdentity } from "../repository/identity.js";

export type ContextAvailabilityInput = {
  repositoryIdentity: RepositoryIdentity;
  revision: string;
  eventBus?: EventBus;
  diff: UnifiedDiff;
};

export type ContextInput = {
  file: DiffFile;
  diff: UnifiedDiff;
  repositoryIdentity: RepositoryIdentity;
  revision: string;
  eventBus?: EventBus;
};

export interface ContextProvider {
  readonly name: string;
  isAvailable(input: ContextAvailabilityInput): Promise<boolean>;
  getContextForFile(input: ContextInput): Promise<ContextChunk[]>;
}
