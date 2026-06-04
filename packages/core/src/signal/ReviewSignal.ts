// packages/core/src/signal/ReviewSignal.ts
export type ReviewSignalType =
  | "bug"
  | "security"
  | "style"
  | "design"
  | "performance";

export type ReviewSeverity = "low" | "medium" | "high";

export type ReviewSource = "rule" | "llm" | "hybrid";

export type ReviewSignal = {
  /** Stable identifier (used for dedupe, tracing) */
  id: string;

  /** What kind of concern this is */
  type: ReviewSignalType;

  /** How bad if ignored */
  severity: ReviewSeverity;

  /** How confident PRsense is (0–1) */
  confidence: number;

  /** File the signal applies to */
  file: string;

  /** Optional line range */
  lineStart?: number;
  lineEnd?: number;

  /** Short, assertive summary */
  message: string;

  /** Optional explanation */
  rationale?: string;

  /** Optional suggestion (non-authoritative) */
  suggestedFix?: string;

  /** Where this came from */
  source: ReviewSource;
};
