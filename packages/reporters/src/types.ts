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

export type ReportStatsInput = {
  outcome: "success" | "failure";

  signals: {
    file: string;
  }[];

  durationMs: number;

  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  model: {
    provider: string;
    name: string;
  };

  context: {
    indexing?: {
      enabled: boolean;
      provider?: string;
      model?: string;
    };
  };

  diff?: {
    validFiles?: Set<string>;
  };
};
