import { Command } from "commander";
import { runDoctorWorkflow } from "../workflows/doctorWorkflow.js";

export const doctorCommand = new Command("doctor")
  .description("Diagnose PRsense installation and environment")
  .action(async () => {
    const exitCode = await runDoctorWorkflow();
    process.exit(exitCode);
  });
