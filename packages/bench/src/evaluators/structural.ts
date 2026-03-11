import type { BenchRun } from "../types.js";

export function evaluateStructural(runs: BenchRun[]) {
  let failures = 0;
  let empty = 0;

  for (const run of runs) {
    if (run.outcome !== "success") failures++;

    if (run.signals.length === 0) {
      empty++;
    }
  }

  return {
    failures,
    empty,
  };
}
