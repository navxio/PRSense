// packages/context/src/chunking/simpleChunker.ts
import type { Chunker } from "./types.js";
import type { ContextChunk } from "@prsense/core";
import { randomUUID } from "node:crypto";

export function createSimpleChunker(opts?: {
  maxLines?: number;
  maxChars?: number;
}): Chunker {
  const maxLines = opts?.maxLines ?? 120;
  const maxChars = opts?.maxChars ?? 8000;

  return {
    chunk({ content, source }) {
      const lines = content.split("\n");
      const chunks: ContextChunk[] = [];

      for (let i = 0; i < lines.length; i += maxLines) {
        const slice = lines.slice(i, i + maxLines);
        let chunkContent = slice.join("\n");

        if (chunkContent.length > maxChars) {
          chunkContent = chunkContent.slice(0, maxChars);
        }

        chunks.push({
          id: randomUUID(),
          source,
          content: chunkContent,
          metadata: {
            lineStart: i + 1,
            lineEnd: i + slice.length,
          },
        });
      }

      return chunks;
    },
  };
}
