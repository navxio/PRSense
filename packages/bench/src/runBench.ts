import { modelMatrix } from "./models.js";
import { libuvScenario } from "./scenarios/libuv.js";
import { evaluateStructural } from "./evaluators/structural.js";
import { evaluateGrounding } from "./evaluators/grounding.js";
import { evaluateStability } from "./evaluators/stability.js";

import type { BenchResult } from "./types.js";

import { runReviewWorkflow } from "@prsense/workflows";

async function runOnce(model: any, scenario: any): Promise<BenchResult> {
  try {
    const result = await runReviewWorkflow({
      reviewTarget: scenario.reviewTarget,
      llm: {
        provider: model.provider,
        model: model.model,
        temperature: model.temperature,
      },
      silent: true,
    });

    return {
      outcome: "success",
      signals: result.signals ?? [],
    };
  } catch (err) {
    return {
      outcome: "failure",
      signals: [],
    };
  }
}

export async function runBench() {
  const scenario = libuvScenario;

  console.log(`\nScenario: ${scenario.id}\n`);

  for (const model of modelMatrix) {
    console.log(`Model: ${model.model}`);

    const runs: BenchResult[] = [];

    for (let i = 0; i < 3; i++) {
      const r = await runOnce(model, scenario);
      runs.push(r);
    }

    const structural = evaluateStructural(runs);
    const stability = evaluateStability(runs);

    // You must extract diff file list from workflow
    const validFiles = new Set<string>(); // TODO wire from diff
    const grounding = evaluateGrounding(validFiles, runs);

    const score =
      -structural.failures * 5 -
      grounding.hallucinated * 2 -
      stability.variance +
      stability.avgSignals;

    console.log({
      ...structural,
      ...stability,
      ...grounding,
      score,
    });

    console.log("-------------\n");
  }
}
