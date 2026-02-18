// packages/workflows/src/review/ports.ts

import type { ContextChunk, UnifiedDiff, ReviewSignal } from "@prsense/core";

export interface ReviewSignalCompiler {
  compile(diff: UnifiedDiff, context: ContextChunk[]): Promise<ReviewSignal[]>;
}
