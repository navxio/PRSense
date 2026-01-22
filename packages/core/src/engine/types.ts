import { ReviewContext, ReviewSignal } from "@prsense/domain";

export type ReviewEngineInput = {
  context: ReviewContext;
};

export type ReviewEngineOutput = {
  signals: ReviewSignal[];
};
