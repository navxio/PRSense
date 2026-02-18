import type { ContextChunk } from "./ContextChunk.js";

export type RetrievedContext = {
  chunks: ContextChunk[];
  stats: {
    totalChunks: number;
    truncated: boolean;
  };
};
