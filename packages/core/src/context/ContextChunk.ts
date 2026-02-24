import { ContextSource } from "./ContextSource.js";

export type ContextChunk = {
  id: string;
  source: ContextSource;
  content: string;
  metadata?: {
    symbols?: string[];
    language?: string;
    path?: string;
    lineStart?: number;
    lineEnd?: number;
    kind?: "code" | "test" | "doc" | "config";
    [key: string]: unknown;
  };
};
