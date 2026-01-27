// apps/cli/src/commands/doctor.ts

import { Command } from "commander";
import { runDoctorWorkflow } from "@prsense/preflight";
import { stdoutDoctorReporter } from "../reporting/stdoutDoctorReporter.js";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";

const logLevel = (process.env.PRSENSE_LOG_LEVEL as any) ?? "info";

const logger = createPinoLogger({
  level: logLevel,
  pretty: true,
});

const eventBus = createEventBus((event) => {
  logEvent(logger, event);
});

export const doctorCommand = new Command("doctor")
  .description("Diagnose PRsense installation and environment")
  .action(async () => {
    eventBus.emit(CoreEvents.RunStarted, {
      mode: "cli",
      command: "doctor",
    });

    try {
      const result = await runDoctorWorkflow({ eventBus });

      await stdoutDoctorReporter(result.payload.checks);

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

      process.exit(result.outcome === "failure" ? 1 : 0);
    } catch (err) {
      eventBus.emit(CoreEvents.RunFailed, {
        error: String(err),
      });

      process.exit(1);
    }
  });
