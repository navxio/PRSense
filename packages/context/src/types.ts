// packages/context/src/types.ts
import { ContextChunk } from "@prsense/core";

export type ResolvedContext = {
  contextByFile: Map<string, ContextChunk[]>;
  contextualReviewAvailable: boolean;
};
