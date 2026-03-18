// packages/reporters/src/stats/computeStats.ts

import type { ReportStatsInput } from "./types.js";

export function computeStats(input: ReportStatsInput) {
  const { signals, usage, durationMs, diff } = input;

  const totalSignals = signals.length;

  const totalTokens = usage?.totalTokens ?? 0;
  const promptTokens = usage?.promptTokens ?? 0;
  const completionTokens = usage?.completionTokens ?? 0;

  const tokensPerSignal =
    totalSignals > 0 ? totalTokens / totalSignals : totalTokens;

  const seconds = durationMs / 1000;

  const signalsPerSecond = seconds > 0 ? totalSignals / seconds : 0;

  const tokensPerSecond = seconds > 0 ? totalTokens / seconds : 0;

  // Grounding
  let hallucinated = 0;

  if (diff?.validFiles) {
    for (const s of signals) {
      if (!diff.validFiles.has(s.file)) {
        hallucinated++;
      }
    }
  }

  const hallucinationRate = totalSignals > 0 ? hallucinated / totalSignals : 0;

  return {
    totalSignals,
    totalTokens,
    promptTokens,
    completionTokens,
    tokensPerSignal,
    durationMs,
    signalsPerSecond,
    tokensPerSecond,
    hallucinated,
    hallucinationRate,
  };
}
