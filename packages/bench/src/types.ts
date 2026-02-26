export type BenchmarkScenario = {
  id: string;
  description: string;
  reviewTarget: string; // PR URL or local path
};

export type ModelConfig = {
  provider: "ollama";
  model: string;
  temperature: number;
};

export type BenchResult = {
  outcome: "success" | "failure";
  signals: {
    file: string;
    message: string;
    startLine?: number;
    endLine?: number;
  }[];
};
