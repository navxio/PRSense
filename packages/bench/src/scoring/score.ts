export function computeScore(metrics: Record<string, number>) {
  const failures = metrics.failures ?? 0;
  const hallucinated = metrics.hallucinated ?? 0;
  const variance = metrics.variance ?? 0;
  const avgSignals = metrics.avgSignals ?? 0;

  return -failures * 5 - hallucinated * 2 - variance + avgSignals;
}
