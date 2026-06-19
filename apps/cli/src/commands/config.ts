// apps/cli/src/commands/config.ts
import { Command } from "commander";
import { resolveEnvironment } from "@prsense/config";
import {
  stdoutConfigInspectReporter,
  stdoutConfigReporter,
} from "@prsense/reporters";
import { classifyTarget } from "../shared/classifyTarget.js";

export const configCommand = new Command("config").description(
  "Inspect and manage PRSense configuration",
);

configCommand
  .command("inspect")
  .description("Show resolved configuration")
  .action(async () => {
    const t = classifyTarget(".");
    const env = resolveEnvironment("cli", {
      root: t.root,
      provider: t.provider,
    });

    if (env.issues.some((i) => i.level === "error")) {
      await stdoutConfigReporter.report({ issues: env.issues });
      process.exit(1);
    }

    await stdoutConfigInspectReporter.report({
      config: env.config,
      credentials: env.credentials,
      issues: env.issues,
    });
    process.exit(0);
  });
