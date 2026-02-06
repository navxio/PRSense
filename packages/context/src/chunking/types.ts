// packages/context/src/chunking/types.ts
import type { ContextChunk } from "@prsense/core";

export interface Chunker {
  chunk(input: {
    content: string;
    source: ContextChunk["source"];
  }): ContextChunk[];
}
