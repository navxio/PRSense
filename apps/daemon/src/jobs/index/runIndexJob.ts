// apps/daemon/src/jobs/index/runIndexJob.ts
import { runIndexWorkflow } from "@prsense/workflows";
import { createEventBus } from "@prsense/core";
import type { IndexJobInput, IndexJobResult } from "./types.js";
import type { ResolvedConfig } from "@prsense/runtime-config";

export async function runIndexJob(
  config: ResolvedConfig,
  input: IndexJobInput,
): Promise<IndexJobResult> {
  const eventBus = createEventBus(() => {
    // daemon mode: log or ignore
  });

  return runIndexWorkflow({
    config,
    target: input.target,
    force: input.force,
    dryRun: input.dryRun,
    eventBus,
  });
}
