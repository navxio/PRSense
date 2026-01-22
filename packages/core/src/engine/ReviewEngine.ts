import { ReviewContext } from "../context/ReviewContext.js";
import { ReviewSignal } from "../signal/ReviewSignal.js";

export type ReviewEngineConfig = {
  enabledRuleIds: string[];
};

export function review(
  ctx: ReviewContext,
  config: ReviewEngineConfig,
): ReviewSignal[] {
  return [];
}
