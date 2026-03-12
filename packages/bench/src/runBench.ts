// packages/bench/src/runBench.ts

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { modelMatrix } from "./models.js";
import { runScenario } from "./runner/runScenario.js";
import { writeResults } from "./persistence/writeResults.js";
import { asyncPool } from "./utils/asyncPool.js";

import type { BenchReport, BenchmarkScenario } from "./types.js";

async function loadScenarios(): Promise<BenchmarkScenario[]> {
  const scenariosDir = path.resolve(
    new URL(".", import.meta.url).pathname,
    "scenarios",
  );

  const files = await fs.readdir(scenariosDir);

  const scenarios: BenchmarkScenario[] = [];

  for (const file of files) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

    const fullPath = path.join(scenariosDir, file);
    const mod = await import(pathToFileURL(fullPath).href);

    for (const value of Object.values(mod)) {
      if (value && typeof value === "object" && "reviewTarget" in value) {
        scenarios.push(value as BenchmarkScenario);
      }
    }
  }

  return scenarios;
}

const MODEL_CONCURRENCY = Number(process.env.PRSENSE_BENCH_CONCURRENCY) || 3;

export async function runBench() {
  const scenarios = await loadScenarios();

  console.log(`Loaded ${scenarios.length} benchmark scenarios\n`);

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\nScenario: ${scenario.id}`);

    const scenarioResults = await asyncPool(
      MODEL_CONCURRENCY,
      modelMatrix,
      async (model) => {
        console.log(`Running ${scenario.id} → ${model.model}`);

        return runScenario(scenario, model);
      },
    );

    results.push(...scenarioResults);
  }

  const report: BenchReport = {
    timestamp: new Date().toISOString(),
    results,
  };

  const file = await writeResults(report);

  console.log("\nBenchmark Complete");
  console.log(`Results written to: ${file}`);
}
