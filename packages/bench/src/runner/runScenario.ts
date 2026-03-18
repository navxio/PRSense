// packages/bench/src/runner/runScenario.ts
import type {
  BenchmarkScenario,
  ModelConfig,
  ModelScenarioResult,
} from "../types.js";
import { runModelOnScenario } from "./runModel.js";
import { evaluateStructural } from "../evaluators/structural.js";
import { evaluateGrounding } from "../evaluators/grounding.js";
import { evaluateStability } from "../evaluators/stability.js";
import { evaluateTokens } from "../evaluators/tokens.js";
import { evaluateTime } from "../evaluators/time.js";

export async function runScenario(
  scenario: BenchmarkScenario,
  model: ModelConfig,
): Promise<ModelScenarioResult> {
  const runs = [];

  for (let i = 0; i < 3; i++) {
    const run = await runModelOnScenario(model, scenario);
    runs.push(run);
  }

  const structural = evaluateStructural(runs);
  const stability = evaluateStability(runs);

  // You should wire real diff files here
  const validFiles = new Set<string>();
  const grounding = evaluateGrounding(validFiles, runs);

  const tokens = evaluateTokens(runs);
  const times = evaluateTime(runs);

  const metrics = {
    ...structural,
    ...stability,
    ...grounding,
    ...tokens,
    ...times,
  };

  return {
    scenarioId: scenario.id,
    model: model.model,
    runs,
    metrics,
  };
}
