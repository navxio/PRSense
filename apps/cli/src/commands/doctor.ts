// apps/cli/src/commands/doctor.ts

import { Command } from "commander";
import { runDoctorWorkflow } from "@prsense/workflows";
import { stdoutDoctorReporter, stdoutConfigReporter } from "@prsense/reporters";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import { resolveEnvironment } from "@prsense/config";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { classifyTarget } from "../shared/classifyTarget.js";

const logLevel = (process.env.PRSENSE_LOG_LEVEL as any) ?? "warn";

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
      const t = classifyTarget(".");
      const env = resolveEnvironment("cli", {
        root: t.root,
        provider: t.provider,
      });

      if (env.issues.length > 0) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter.report({
          issues: env.issues,
        });
        process.exit(1);
      }
      const result = await runDoctorWorkflow({ config: env.config, eventBus });

      await stdoutDoctorReporter.report(result);

      const hasFailures = result.checks.some((c) => c.status === "fail");

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: hasFailures ? "failure" : "success",
      });

      process.exit(hasFailures ? 1 : 0);
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
