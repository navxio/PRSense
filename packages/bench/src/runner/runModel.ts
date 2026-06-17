// packages/bench/src/runner/runModel.ts
import type { BenchmarkScenario, ModelConfig, BenchRun } from "../types.js";
import { ResolvedConfig, resolveEnvironment } from "@prsense/config";

import { runReviewWorkflow } from "@prsense/workflows";
import { GitHubPrDiffProvider } from "@prsense/context";

import { benchConfig } from "../benchConfig.js";
import { silentEventBus } from "../utils/silentEventBus.js";
import { extractPRDetails, type PRDetails } from "../utils/PR.js";
import { buildServices } from "./composition.js";

const eventBus = silentEventBus();

export async function runModelOnScenario(
  model: ModelConfig,
  scenario: BenchmarkScenario,
): Promise<BenchRun> {
  const TIMEOUT_MS = model.provider === "ollama" ? 120_000 : 60_000;
  const start = Date.now();
  const services = buildServices();

  const GH_TOKEN = process.env.PRSENSE_GITHUB_BENCH_TOKEN;
  try {
    const runtimeEnv = resolveEnvironment("cli", {
      root: ".",
      provider: "github",
    });

    const config: ResolvedConfig = {
      ...benchConfig,
      llm: {
        ...benchConfig.llm,
        provider: model.provider,
        model: model.model,
        temperature: model.temperature,
      },
    };

    const PRData: PRDetails = extractPRDetails(scenario.reviewTarget);

    const diffProvider = new GitHubPrDiffProvider(
      PRData.owner,
      PRData.repo,
      String(PRData.prNumber),
      GH_TOKEN,
    );

    const workflowPromise = runReviewWorkflow({
      config,
      credentials: runtimeEnv.credentials,
      diffProvider,
      eventBus,
      repository: services.chunkRepo,
      metadataRepository: services.metadataRepo,
    });

    const result = await Promise.race([
      workflowPromise,
      timeoutPromise(TIMEOUT_MS),
    ]);

    const duration = Date.now() - start;

    if (result.payload.usage) {
      return {
        durationMs: duration,
        outcome: result.outcome === "success" ? "success" : "failure",
        signals: result.payload?.signals ?? [],
        usage: result.payload.usage,
      };
    }
    return {
      durationMs: duration,
      outcome: result.outcome === "success" ? "success" : "failure",
      signals: result.payload?.signals ?? [],
    };
  } catch (err: unknown) {
    const duration = Date.now() - start;

    const message = err instanceof Error ? err.message : String(err);

    return {
      durationMs: duration,
      outcome: message === "timeout" ? "timeout" : "failure",
      signals: [],
      error: message,
    };
  }
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms),
  );
}
