import { ReviewContext } from "../context/ReviewContext.js";
import {
  ReviewSignal,
  ReviewSignalType,
  ReviewSeverity,
} from "../signal/ReviewSignal.js";

// rules are pure functions with metadata
export interface ReviewRule {
  /** Stable config-facing identifier */
  id: string;

  /** Short human-readable name */
  title: string;

  /** What kind of signal this rule emits */
  type: ReviewSignalType;

  /** Default severity (overridable by config) */
  defaultSeverity: ReviewSeverity;

  /** Default confidence (rules are usually high-confidence) */
  defaultConfidence: number;

  /** Whether the rule applies to this context */
  applies(ctx: ReviewContext): boolean;

  /** Execute the rule */
  run(ctx: ReviewContext): ReviewSignal[];
}
