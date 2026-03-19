//apps/daemon/src/jobs/index/runIndexJob.ts
import { runIndexWorkflow } from "@prsense/workflows";
import { createEventBus } from "@prsense/core";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import type { Logger } from "@prsense/logging";
import type { IndexJobInput } from "./types.js";

import pkg from "../../../package.json" with { type: "json" };

const PRSENSE_DAEMON_VERSION = pkg.version;
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
    version: PRSENSE_DAEMON_VERSION, //TODO: separate it into runtimeType and runtimeVersion
  });
}
