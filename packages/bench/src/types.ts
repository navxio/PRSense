// packages/bench/src/types.ts

export type BenchmarkScenario = {
  id: string;
  description: string;
  reviewTarget: string;
  tags?: string[];
};

export type ModelConfig = {
  provider: "ollama" | "anthropic" | "openai" | "google";
  model: string;
  temperature: number;
};

export type BenchSignal = {
  file: string;
  message: string;
  startLine?: number;
  endLine?: number;
};

export type BenchRun = {
  durationMs: number;
  outcome: "success" | "failure" | "timeout";
  signals: BenchSignal[];
  error?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
};

export type ModelScenarioResult = {
  scenarioId: string;
  model: string;
  runs: BenchRun[];
  metrics: Record<string, number>;
  score: number;
};

export type BenchReport = {
  timestamp: string;
  gitSha?: string;
  results: ModelScenarioResult[];
};

/**
 * Backward-compatible alias used by earlier benchmark utilities.
 */
export type BenchResult = ModelScenarioResult;
