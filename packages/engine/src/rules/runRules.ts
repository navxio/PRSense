import { ReviewContext, ReviewRule, ReviewSignal } from "@prsense/domain";

export function runRules(
  ctx: ReviewContext,
  rules: ReviewRule[],
): ReviewSignal[] {
  const signals: ReviewSignal[] = [];

  for (const rule of rules) {
    if (!rule.applies(ctx)) continue;
    signals.push(...rule.run(ctx));
  }

  return signals;
}
