// packages/context/src/chunking/charChunker.ts
import type { Chunker } from "./types.js";
import type { ContextChunk, ContextSource } from "@prsense/core";
import { randomUUID } from "node:crypto";

export type CharChunkerOptions = {
  maxChars: number;
  overlapChars: number;
};

export function createCharChunker(options: CharChunkerOptions): Chunker {
  const { maxChars, overlapChars } = options;

  if (overlapChars >= maxChars) {
    throw new Error("chunkOverlapChars must be smaller than chunkSizeChars");
  }

  return {
    chunk({ content, source }: { content: string; source: ContextSource }) {
      const chunks: ContextChunk[] = [];

      let start = 0;

      while (start < content.length) {
        const end = Math.min(start + maxChars, content.length);
        const slice = content.slice(start, end);

        chunks.push({
          id: randomUUID(),
          source,
          content: slice,
        });

        if (end === content.length) break;

        start = end - overlapChars;
      }

      return chunks;
    },
  };
}
