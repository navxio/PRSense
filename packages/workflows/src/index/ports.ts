// packages/workflows/src/index/ports.ts

import type { ContextChunk } from "@prsense/core";

export interface ContextIndexer {
  buildChunks(): Promise<ContextChunk[]>;
  persistChunks(chunks: ContextChunk[]): Promise<void>;
}
