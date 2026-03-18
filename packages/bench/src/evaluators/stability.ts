// packages/bench/src/evaluators/stability.ts
import type { BenchRun } from "../types.js";

export function evaluateStability(runs: BenchRun[]) {
  const counts = runs.map((r) => r.signals.length);

  const baseline = counts[0] ?? 0;

  const variance =
    counts.reduce((acc, c) => acc + Math.abs(c - baseline), 0) /
    (counts.length || 1);

  const avgSignals =
    counts.reduce((acc, c) => acc + c, 0) / (counts.length || 1);

  return {
    variance,
    avgSignals,
  };
}
