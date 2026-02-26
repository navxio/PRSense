import type { BenchResult } from "../types.js";

export function evaluateStability(results: BenchResult[]) {
  const counts = results.map((r) => r.signals.length);

  const baseline = counts[0] ?? 0;

  const variance =
    counts.reduce((acc, c) => acc + Math.abs(c - baseline), 0) /
    (counts.length || 1);

  const avg = counts.reduce((acc, c) => acc + c, 0) / (counts.length || 1);

  return {
    variance,
    avgSignals: avg,
  };
}
