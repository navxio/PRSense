// apps/cli/src/commands/config.ts
import { Command } from "commander";
import { resolveEnvironment } from "@prsense/config";
import {
  stdoutConfigInspectReporter,
  stdoutConfigReporter,
} from "@prsense/reporters";

export const configCommand = new Command("config").description(
  "Inspect and manage PRSense configuration",
);

configCommand
  .command("inspect")
  .description("Show resolved configuration with provenance")
  .action(async (options) => {
    const env = resolveEnvironment("cli", {
      root: ".",
      provider: "filesystem",
    });

    if (env.issues.some((i) => i.level === "error")) {
      await stdoutConfigReporter.report({ issues: env.issues });
      process.exit(1);
    }

    await stdoutConfigInspectReporter.report({
      config: env.config,
      provenance: env.provenance,
      credentials: env.credentials,
      issues: env.issues, // include warnings if any
      format: options.json ? "json" : "table",
    });

    process.exit(0);
  });
