import { Command } from "commander";
import { runReviewWorkflow } from "@prsense/workflows";
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
import path from "node:path";
import { LocalGitDiffProvider } from "@prsense/context";

export const reviewCommand = new Command("review")
  .argument("[target]", "Path to repository", ".")
  .option("--base-branch <branch>", "Base branch to diff against")
  .action(async (target, options) => {
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
      command: "review",
    });

    try {
      // -------------------------------------------------
      // Load Config
      // -------------------------------------------------

      const user = loadUserConfig(process.cwd());
      const env = loadEnvConfig();

      const credentialContext = buildCredentialContext(env, {
        mode: "self-hosted",
      });

      const repoRoot = path.resolve(target);

      const resolved = resolveConfig({
        mode: "cli",
        repoRoot,
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
      // Create Diff Provider
      // -------------------------------------------------

      const diffProvider = new LocalGitDiffProvider(
        repoRoot,
        options.baseBranch,
      );

      // -------------------------------------------------
      // Run Review Workflow
      // -------------------------------------------------

      const result = await runReviewWorkflow({
        config: resolved,
        diffProvider,
        eventBus,
      });

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

      if (result.outcome === "failure") {
        process.exit(1);
      }

      // -------------------------------------------------
      // Print Signals
      // -------------------------------------------------

      for (const signal of result.payload.signals) {
        console.log(`\n[${signal.severity.toUpperCase()}] ${signal.file}`);
        console.log(signal.message);

        if (signal.rationale) {
          console.log(`  ↳ ${signal.rationale}`);
        }

        if (signal.suggestedFix) {
          console.log(`  💡 ${signal.suggestedFix}`);
        }
      }

      process.exit(0);
    } catch (err) {
      eventBus.emit(CoreEvents.RunFailed, {
        error: String(err),
      });

      process.exit(1);
    }
  });
