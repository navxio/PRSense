// packages/workflows/src/review/ports.ts

import type { ContextChunk, UnifiedDiff, ReviewSignal } from "@prsense/core";
import type { RetrievedContext } from "@prsense/context";

export interface ContextRetriever {
  retrieve(diff: UnifiedDiff): Promise<RetrievedContext>;
}

export interface ReviewSignalCompiler {
  compile(diff: UnifiedDiff, context: ContextChunk[]): Promise<ReviewSignal[]>;
}
