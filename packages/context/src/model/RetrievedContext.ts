import { ContextChunk } from "./ContextChunk.js";
import { RetrievalTrace } from "../debug/index.js";

export type RetrievedContext = {
  chunks: ContextChunk[];
  stats: {
    totalChunks: number;
    truncated: boolean;
  };
};

export type RetrievedContextWithDebug = RetrievedContext & {
  debug?: RetrievalTrace;
};
