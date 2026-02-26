import type { BenchResult } from "../types.js";

export function evaluateGrounding(
  validFiles: Set<string>,
  results: BenchResult[],
) {
  let hallucinated = 0;

  for (const r of results) {
    for (const s of r.signals) {
      if (!validFiles.has(s.file)) {
        hallucinated++;
      }
    }
  }

  return { hallucinated };
}
