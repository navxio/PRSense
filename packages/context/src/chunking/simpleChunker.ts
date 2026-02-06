// packages/context/src/chunking/simpleChunker.ts
import type { Chunker } from "./types.js";
import type { ContextChunk } from "@prsense/core";
import { randomUUID } from "node:crypto";

export function createSimpleChunker(maxLines = 200): Chunker {
  return {
    chunk({ content, source }) {
      const lines = content.split("\n");
      const chunks: ContextChunk[] = [];

      for (let i = 0; i < lines.length; i += maxLines) {
        const slice = lines.slice(i, i + maxLines);
        chunks.push({
          id: randomUUID(),
          source,
          content: slice.join("\n"),
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
