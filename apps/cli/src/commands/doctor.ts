// apps/cli/src/commands/doctor.ts

import { Command } from "commander";
import { runDoctorWorkflow } from "@prsense/workflows";
import { stdoutDoctorReporter } from "../reporting/stdoutDoctorReporter.js";

export const doctorCommand = new Command("doctor")
  .description("Diagnose PRsense installation and environment")
  .action(async () => {
    const result = await runDoctorWorkflow();

    await stdoutDoctorReporter(result.payload.checks);

    process.exit(result.outcome === "failure" ? 1 : 0);
  });
