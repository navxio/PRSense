import { Command } from "commander";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  validateResolvedConfig,
  buildCredentialContext,
} from "@prsense/runtime-config";
import { loadUserConfig, loadEnvConfig } from "@prsense/config";
import { resolveConfig } from "../resolveConfig.js";
import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter } from "../reporting/stdoutConfigReporter.js";

import { runSetupWorkflow } from "@prsense/workflows";
import type { Capability } from "@prsense/preflight";

import {
  postgresCapability,
  pgVectorCapability,
  dockerCapability,
  schemaCapability,
} from "@prsense/preflight";

export const setupCommand = new Command("setup")
  .description("Validate and optionally provision required infrastructure")
  .action(async () => {
    const logLevel = (process.env.PRSENSE_LOG_LEVEL as any) ?? "warn";

    const logger = createPinoLogger({
      level: logLevel,
      pretty: true,
    });

    const renderer = createSpinnerRenderer(process.stdout);

    const eventBus = createEventBus((event) => {
      logEvent(logger, event);

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

    eventBus.emit(CoreEvents.RunStarted, {
      mode: "cli",
      command: "setup",
    });

    try {
      // -------------------------------------------------
      // Load Config
      // -------------------------------------------------

      const cwd = process.cwd();
      const user = loadUserConfig(cwd);
      const env = loadEnvConfig();

      const credentialContext = buildCredentialContext(env, {
        mode: "self-hosted",
      });

      const resolved = resolveConfig({
        mode: "cli",
        repoRoot: cwd,
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

      // -------------------------------------------------
      // Capabilities
      // -------------------------------------------------

      const capabilities: Capability[] = [
        dockerCapability,
        postgresCapability,
        pgVectorCapability,
        schemaCapability,
      ];

      const result = await runSetupWorkflow({
        capabilities,
        ctx: {
          config: resolved,
          env: process.env,
          cwd,
        },
        eventBus,
      });

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

      // -------------------------------------------------
      // Human Summary
      // -------------------------------------------------

      console.log("\nSetup Summary:");

      for (const step of result.steps) {
        if (step.outcome === "applied") {
          console.log(`✔ ${step.id} applied`);
        } else if (step.outcome === "skipped") {
          console.log(`• ${step.id} ready`);
        } else {
          console.log(`✖ ${step.id} failed`);
          if (step.error) {
            console.log(`  ↳ ${step.error}`);
          }
        }
      }

      process.exit(result.outcome === "failure" ? 1 : 0);
    } catch (err) {
      eventBus.emit(CoreEvents.RunFailed, {
        error: String(err),
      });

      process.exit(1);
    }
  });
