import { ReviewRule } from "@prsense/domain";
import { todoDetectionRule } from "./todoDetection.js";

export const ruleRegistry: Record<string, ReviewRule> = {
  [todoDetectionRule.id]: todoDetectionRule,
};
