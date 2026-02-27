import { runIndexWorkflow } from "@prsense/workflows";
import { createEventBus } from "@prsense/core";
import type {
  ResolvedConfig,
  CredentialContext,
} from "@prsense/runtime-config";
import type { Logger } from "@prsense/logging";
import type { IndexJobInput } from "./types.js";

export async function runIndexJob(
  input: IndexJobInput,
  config: ResolvedConfig,
  credentials: CredentialContext,
  logger: Logger,
) {
  const eventBus = createEventBus((event) => {
    logger.info("domain.event", {
      event: event.event,
      fields: event.fields,
    });
  });

  return runIndexWorkflow({
    config,
    credentials,
    target: input.target,
    ...(input.force !== undefined ? { force: input.force } : {}),
    ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
    eventBus,
  });
}
