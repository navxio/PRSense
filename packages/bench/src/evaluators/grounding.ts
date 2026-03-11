import type { BenchRun } from "../types.js";

export function evaluateGrounding(validFiles: Set<string>, runs: BenchRun[]) {
  let hallucinated = 0;

  for (const run of runs) {
    for (const signal of run.signals) {
      if (!validFiles.has(signal.file)) {
        hallucinated++;
      }
    }
  }

  return {
    hallucinated,
  };
}
