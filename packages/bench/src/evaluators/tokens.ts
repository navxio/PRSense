// packages/bench/src/evaluators/tokens.ts

import type { BenchRun } from "../types.js";

export function evaluateTokens(runs: BenchRun[]) {
  let totalTokens = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  let runsWithUsage = 0;
  let totalSignals = 0;
  let totalDurationMs = 0;

  for (const run of runs) {
    totalSignals += run.signals.length;
    totalDurationMs += run.durationMs;

    if (run.usage) {
      runsWithUsage++;

      totalTokens += run.usage.totalTokens;
      totalPromptTokens += run.usage.promptTokens;
      totalCompletionTokens += run.usage.completionTokens;
    }
  }

  const safeRuns = runsWithUsage || 1;

  const avgTokens = totalTokens / safeRuns;
  const avgPromptTokens = totalPromptTokens / safeRuns;
  const avgCompletionTokens = totalCompletionTokens / safeRuns;

  const tokensPerSignal = totalSignals > 0 ? totalTokens / totalSignals : 0;

  const tokensPerSecond =
    totalDurationMs > 0 ? totalTokens / (totalDurationMs / 1000) : 0;

  return {
    avgTokens,
    avgPromptTokens,
    avgCompletionTokens,
    tokensPerSignal,
    tokensPerSecond,
  };
}
