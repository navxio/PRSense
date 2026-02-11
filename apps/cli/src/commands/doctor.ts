// apps/cli/src/commands/doctor.ts

import { Command } from "commander";
import { runDoctorWorkflow } from "@prsense/workflows";
import { stdoutDoctorReporter } from "../reporting/stdoutDoctorReporter.js";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  validateResolvedConfig,
  buildCredentialContext,
} from "@prsense/runtime-config";
import { loadUserConfig, loadEnvConfig } from "@prsense/config";
import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter } from "../reporting/stdoutConfigReporter.js";
import { resolveConfig } from "../resolveConfig.js";

const logLevel = (process.env.PRSENSE_LOG_LEVEL as any) ?? "info";

const logger = createPinoLogger({
  level: logLevel,
  pretty: true,
});

const renderer = createSpinnerRenderer(process.stdout);

const eventBus = createEventBus((event) => {
  // structured logs -> stderr
  logEvent(logger, event);
  // ui ->stdout
  const mapped = eventToCliTask(event);
  if (!mapped) return;
  if (mapped.kind === "start") {
    renderer.start(mapped.task);
  } else if (mapped.kind === "update") {
    renderer.update(mapped.task);
  } else {
    renderer.finish(mapped.task);
  }
});

export const doctorCommand = new Command("doctor")
  .description("Diagnose PRsense installation and environment")
  .action(async () => {
    eventBus.emit(CoreEvents.RunStarted, {
      mode: "cli",
      command: "doctor",
    });

    try {
      const user = loadUserConfig(process.cwd());
      const env = loadEnvConfig();
      const credentialContext = buildCredentialContext(env, {
        mode: "self-hosted",
      });
      const resolved = resolveConfig({
        mode: "cli",
        repoRoot: process.cwd(),
        repoProvider: "filesystem",
        user,
        env,
      });

      const validation = validateResolvedConfig(resolved, credentialContext);
      if (!validation.valid) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter(validation.issues);
        process.exit(1);
      }
      const result = await runDoctorWorkflow({ config: resolved, eventBus });

      await stdoutDoctorReporter(result.payload.checks);

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

      process.exit(result.outcome === "failure" ? 1 : 0);
    } catch (err) {
      eventBus.emit(CoreEvents.RunFailed, {
        error: String(err),
      });

      renderer.finish({
        id: "run",
        label: "PRSense failed",
        state: "failed",
      });
      return;
    }
  });
