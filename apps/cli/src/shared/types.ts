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

export type DoctorCheckResult =
  | { status: "ok"; name: string }
  | { status: "warn"; name: string; message: string }
  | { status: "fail"; name: string; message: string; fix?: string };
