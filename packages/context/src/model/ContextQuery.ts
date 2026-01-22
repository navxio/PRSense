import { UnifiedDiff, ReviewSignal } from "@prsense/core";

export type ContextQuery = {
  diff: UnifiedDiff;
  signalsSoFar: ReviewSignal[];
  intent: {
    kind:
      | "understand-change"
      | "validate-convention"
      | "assess-risk"
      | "check-tests";
  };
};
