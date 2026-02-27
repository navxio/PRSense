// apps/daemon/src/jobs/index/runIndexJob.ts
import { runIndexWorkflow } from "@prsense/workflows";
import { createEventBus } from "@prsense/core";
import { type Logger } from "@prsense/logging";
import type { IndexJobInput, IndexJobResult } from "./types.js";
import type { ResolvedConfig } from "@prsense/runtime-config";

export async function runIndexJob(
  config: ResolvedConfig,
  input: IndexJobInput,
  logger: Logger,
): Promise<IndexJobResult> {
  const eventBus = createEventBus((event) => {
    logger.info("domain.event", {
      event: event.event,
      fields: event.fields,
    });
  });

  return runIndexWorkflow({
    config,
    target: input.target,
    force: input.force,
    dryRun: input.dryRun,
    eventBus,
  });
}
