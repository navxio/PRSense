import type { BenchResult } from "../types.js";

export function evaluateStructural(results: BenchResult[]) {
  let failures = 0;
  let empty = 0;

  for (const r of results) {
    if (r.outcome === "failure") failures++;
    if (r.signals.length === 0) empty++;
  }

  return {
    failures,
    empty,
  };
}
