import { ContextChunk } from "../model/ContextChunk.js";
import { ContextQuery } from "../model/ContextQuery.js";

export type RetrievedChunkDebug = {
  chunk: ContextChunk;
  reasons: RetrievalReason[];

  rank?: number; // position before truncation
  similarityScore?: number;
};
export type RetrievalReason =
  | {
      kind: "semantic_similarity";
      score: number;
    }
  | {
      kind: "filesystem_match";
      reason: "same_file" | "imported_file" | "nearby_change";
    }
  | {
      kind: "rule_requested";
      ruleId: string;
    }
  | {
      kind: "fallback";
      reason: string;
    };

export type RetrievalStats = {
  totalCandidates: number;
  returned: number;
  truncated: boolean;

  limits: {
    maxChunks: number;
    maxTokens?: number;
  };
};

export type RetrievalTrace = {
  query: ContextQuery;

  chunks: RetrievedChunkDebug[];

  stats: RetrievalStats;

  timestamp: Date;
};
