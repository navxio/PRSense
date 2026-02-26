import { scenarios } from "./scenarios/registry.js";
import { modelMatrix } from "./models.js";
import { runScenario } from "./runner/runScenario.js";
import { writeResults } from "./persistence/writeResults.js";
import type { BenchReport } from "./types.js";

export async function runBench() {
  const results = [];

  for (const scenario of scenarios) {
    for (const model of modelMatrix) {
      console.log(`Running ${scenario.id} → ${model.model}`);

      const result = await runScenario(scenario, model);
      results.push(result);
    }
  }

  const report: BenchReport = {
    timestamp: new Date().toISOString(),
    results,
  };

  const file = await writeResults(report);

  console.log("\nBenchmark Complete");
  console.log(`Results written to: ${file}`);
}
