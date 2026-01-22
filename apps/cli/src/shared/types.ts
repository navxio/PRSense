import { ReviewSignal } from "@prsense/core";

export type CliReviewResult = {
  signals: ReviewSignal[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
};
