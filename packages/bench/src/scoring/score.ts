// packages/bench/src/scoring/score.ts

export function computeScore(metrics: Record<string, number>) {
  const failures = metrics.failures ?? 0;
  const hallucinated = metrics.hallucinated ?? 0;
  const avgSignals = metrics.avgSignals ?? 0;
  const variance = metrics.variance ?? 0;

  const totalSignals = metrics.totalSignals ?? 0;
  const avgTokens = metrics.avgTokens ?? 0;

  // --- Derived metrics ---
  const hallucinationRate = totalSignals > 0 ? hallucinated / totalSignals : 0;

  const tokensPerSignal = totalSignals > 0 ? avgTokens / avgSignals : avgTokens;

  // --- Weights ---
  const FAILURE_PENALTY = 5;
  const HALLUCINATION_PENALTY = 10; // stronger (rate-based)
  const VARIANCE_PENALTY = 1;
  const TOKEN_PENALTY = 0.001; // gentle
  const SIGNAL_REWARD = 2;

  const score =
    -failures * FAILURE_PENALTY -
    hallucinationRate * HALLUCINATION_PENALTY -
    variance * VARIANCE_PENALTY -
    tokensPerSignal * TOKEN_PENALTY +
    avgSignals * SIGNAL_REWARD;

  return score;
}
