// packages/bench/src/evaluators/time.ts

import type { BenchRun } from "../types.js";

export function evaluateTime(runs: BenchRun[]) {
  let totalTime = 0;
  let maxTime = 0;

  for (const run of runs) {
    totalTime += run.durationMs;
    if (run.durationMs > maxTime) {
      maxTime = run.durationMs;
    }
  }

  const count = runs.length || 1;

  const avgLatencyMs = totalTime / count;

  return {
    avgLatencyMs,
    maxLatencyMs: maxTime,
  };
}
