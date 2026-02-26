import type { BenchmarkScenario, ModelConfig, BenchRun } from "../types.js";

import { runReviewWorkflow } from "@prsense/workflows";
import { loadConfig } from "@prsense/config";
import { makeDiffProvider } from "@prsense/context";
import { silentEventBus } from "@prsense/runtime-config";

const TIMEOUT_MS = 60_000;

export async function runModelOnScenario(
  model: ModelConfig,
  scenario: BenchmarkScenario,
): Promise<BenchRun> {
  const start = Date.now();

  try {
    // 1️⃣ Load base config
    const baseConfig = await loadConfig({
      cwd: process.cwd(),
    });

    // 2️⃣ Override model deterministically
    const config = {
      ...baseConfig,
      llm: {
        ...baseConfig.llm,
        provider: model.provider,
        model: model.model,
        temperature: model.temperature,
      },
    };

    // 3️⃣ Build diff provider
    const diffProvider = await makeDiffProvider({
      target: scenario.reviewTarget,
      cwd: process.cwd(),
    });

    const eventBus = silentEventBus();

    // 4️⃣ Execute with timeout
    const result = await Promise.race([
      runReviewWorkflow({
        config,
        diffProvider,
        eventBus,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
      ),
    ]);

    const duration = Date.now() - start;

    // 🔐 Fix for "result is unknown"
    const typed = result as {
      outcome: string;
      payload?: { signals?: any[] };
    };

    return {
      durationMs: duration,
      outcome: typed.outcome === "success" ? "success" : "failure",
      signals: typed.payload?.signals ?? [],
    };
  } catch (err: any) {
    const duration = Date.now() - start;

    return {
      durationMs: duration,
      outcome: err?.message === "timeout" ? "timeout" : "failure",
      signals: [],
      error: String(err),
    };
  }
}
