import { ContextSource } from "./ContextSource.js";
import type { Language } from "./Language.js";

export type ContextChunk = {
  id: string;
  source: ContextSource;
  content: string;
  metadata?: {
    symbols?: string[];
    language?: Language;
    path?: string;
    lineStart?: number;
    lineEnd?: number;
  };
};
