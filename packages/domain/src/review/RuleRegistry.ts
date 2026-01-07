/* Rule Vocabulary */
import { ReviewRule } from "./ReviewRule.js";

export type RuleId = string;

export type RuleRegistry = {
  [id: RuleId]: ReviewRule;
};
