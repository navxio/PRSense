import type { ReviewSignal } from "@prsense/core";

export type OutputReporter<T> = {
  report(result: T): Promise<void>;
};

export type ReviewContext = {
  targetUrl: string;
  repositoryProvider: "github" | "gitlab";
};

export type DeliveryReporter = {
  deliver(signals: ReviewSignal[], context: ReviewContext): Promise<void>;
};
