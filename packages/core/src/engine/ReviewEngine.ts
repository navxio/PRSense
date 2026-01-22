import { ReviewContext, ReviewSignal } from "@prsense/domain";

export type ReviewEngineConfig = {
  enabledRuleIds: string[];
};

export function review(
  ctx: ReviewContext,
  config: ReviewEngineConfig,
): ReviewSignal[] {
  return [];
}
