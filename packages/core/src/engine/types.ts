import { ReviewContext } from "../context/ReviewContext.js";
import { ReviewSignal } from "../signal/ReviewSignal.js";

export type ReviewEngineInput = {
  context: ReviewContext;
};

export type ReviewEngineOutput = {
  signals: ReviewSignal[];
};
