import type { ReviewSignal } from "@prsense/core";

export type ReviewContext = {
  targetUrl: string;
  repositoryProvider: "github" | "gitlab";
};

export interface Reporter {
  deliver(signals: ReviewSignal[], context: ReviewContext): Promise<void>;
}
