import { ReviewSignal } from "@prsense/domain";

export type CliReviewResult = {
  signals: ReviewSignal[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
};
