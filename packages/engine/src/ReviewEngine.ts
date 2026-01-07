import { ReviewContext, ReviewSignal, ReviewRule } from "@prsense/domain";
import { runRules } from "./rules/runRules.js";
import { ruleRegistry } from "./rules/index.js";

export type ReviewEngineConfig = {
  enabledRuleIds: string[];
};

export function review(
  ctx: ReviewContext,
  config: ReviewEngineConfig,
): ReviewSignal[] {
  const rules: ReviewRule[] = config.enabledRuleIds.map((id) => {
    const rule = ruleRegistry[id];
    if (!rule) {
      throw new Error(`Unknown rule: ${id}`);
    }
    return rule;
  });

  return runRules(ctx, rules);
}
