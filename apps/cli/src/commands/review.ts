// apps/cli/src/commands/review.ts
import { Command } from "commander";
import { runReviewWorkflow, runIndexWorkflow } from "@prsense/workflows";
import { createPinoLogger, logEvent, LogLevel } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  issuesFor,
  resolveEnvironment,
  REVIEW_PREFIXES,
  validateEnvironment,
  ValidationIssue,
} from "@prsense/config";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import {
  stdoutConfigReporter,
  printStats,
  printSignals,
} from "@prsense/reporters";
import {
  LocalGitDiffProvider,
  GitHubPrDiffProvider,
  GitLabMrDiffProvider,
  CodebergPrDiffProvider,
} from "@prsense/context";
import { buildOverrides, applyOverrides } from "../shared/configOverride.js";
import { ensureInit } from "./init/ensureInit.js";

import pkg from "../../package.json" with { type: "json" };
import { buildServices } from "../composition.js";
import { classifyTarget } from "../shared/classifyTarget.js";

const PRSENSE_VERSION = pkg.version;

export const reviewCommand = new Command("review")
  .argument("[target]", "Path to repository", ".")
  .option("-b, --base-branch <branch>", "Base branch to diff against")
  .option("-n, --top-signals <n>", "Number of highest risk signals to display")
  .option(
    "-c, --max-chunks <n>",
    "Maximum number of indexed chunks to retrieve for context",
    Number,
  )
  .option(
    "-k, --confidence-threshold <n>",
    "Minimum llm confidence in a signal to be included in result",
    Number,
  )
  .option(
    "-p, --llm-provider <provider>",
    "LLM provider for running the review",
  )
  .option(
    "-m, --llm-model <model>",
    "Canonical model name as prescribed by the provider",
  )
  .option("-t, --llm-temperature <n>", "LLM temperature", Number)
  .option("-s, --stats", "Print Stats related to review")
  .option("--no-auto-index", "Skip automatic incremental indexing")
  .action(async (target, options) => {
    await ensureInit();
    const services = buildServices();

    const logger = createPinoLogger({
      level: (process.env.PRSENSE_LOG_LEVEL ?? "warn") as LogLevel,
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

      const t = classifyTarget(target);

      const env = resolveEnvironment("cli", {
        root: t.root,
        provider: t.provider,
      });

      if (env.issues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter.report({ issues: env.issues });
        process.exit(1);
      }

      const overrides = buildOverrides(options);
      const effectiveConfig = applyOverrides(env.config, overrides);

      const effectiveIssues = validateEnvironment(
        effectiveConfig,
        env.credentials,
      );
      const reviewConfigurationIssues = issuesFor(
        effectiveIssues,
        REVIEW_PREFIXES,
      );

      if (
        reviewConfigurationIssues.some(
          (i: ValidationIssue) => i.level === "error",
        )
      ) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-cli-config",
        });

        await stdoutConfigReporter.report({
          issues: reviewConfigurationIssues,
        });
        process.exit(1);
      }

      eventBus.emit(CoreEvents.RunConfigDetermined, {
        config: effectiveConfig,
      });

      // -------------------------------------------------
      // Auto-index (incremental)
      // -------------------------------------------------

      if (options.autoIndex) {
        try {
          //TODO: move away from passing raw target here
          await runIndexWorkflow({
            config: effectiveConfig,
            credentials: env.credentials,
            target,
            force: false,
            dryRun: false,
            eventBus,
            version: PRSENSE_VERSION,
            ref: effectiveConfig.git?.baseBranch,
            chunkRepository: services.chunkRepo,
            metadataRepository: services.metadataRepo,
          });
        } catch (err) {
          // Non-fatal: proceed without fresh index context
          eventBus.emit(CoreEvents.RunFailed, {
            reason: "auto-index-failed",
            error: String(err),
          });
        }
      }

      // -------------------------------------------------
      // Create Diff Provider
      // -------------------------------------------------

      console.log("→ Running review...\n");

      const diffProvider =
        t.provider === "github"
          ? new GitHubPrDiffProvider(t.owner, t.repo, t.pr)
          : t.provider === "gitlab"
            ? new GitLabMrDiffProvider(t.group, t.project, t.mr)
            : t.provider === "codeberg"
              ? new CodebergPrDiffProvider(
                  t.owner,
                  t.repo,
                  t.pr,
                  env.credentials.codeberg?.token,
                )
              : new LocalGitDiffProvider(
                  t.root,
                  effectiveConfig.git?.baseBranch,
                );

      // -------------------------------------------------
      // Run Review Workflow
      // -------------------------------------------------

      const start = Date.now();

      const result = await runReviewWorkflow({
        repository: services.chunkRepo,
        metadataRepository: services.metadataRepo,
        config: effectiveConfig,
        credentials: env.credentials,
        diffProvider,
        eventBus,
      });

      const durationMs = Date.now() - start;

      if (options.stats) {
        if (result.outcome === "success") {
          const { signals, usage, diffSummary } = result.payload;

          const validFiles = new Set(diffSummary?.files ?? []);

          printStats({
            outcome: result.outcome,
            signals,
            durationMs,
            model: {
              provider: effectiveConfig.llm.provider,
              name: effectiveConfig.llm.model,
            },
            context: {
              indexing: {
                enabled: true,
                provider: effectiveConfig.embeddings.provider,
                model: effectiveConfig.embeddings.model,
              },
            },
            diff: {
              validFiles,
            },
            ...(usage && { usage }),
          });
        } else {
          printStats({
            outcome: result.outcome,
            signals: [],
            durationMs,
            model: {
              provider: effectiveConfig.llm.provider,
              name: effectiveConfig.llm.model,
            },
            context: {
              indexing: {
                enabled: true,
                provider: effectiveConfig.embeddings.provider,
                model: effectiveConfig.embeddings.model,
              },
            },
          });
        }
      }

      eventBus.emit(CoreEvents.RunFinished, {
        outcome: result.outcome,
      });

      if (result.outcome === "failure") {
        process.exit(1);
      }

      // -------------------------------------------------
      // Print Signals
      // -------------------------------------------------

      if (result.payload.signals.length === 0) {
        console.log("✔ No review signals (change looks safe).");
        process.exit(0);
      }

      printSignals(result.payload.signals, result.payload.totalBeforeCap);

      process.exit(0);
    } catch (err) {
      eventBus.emit(CoreEvents.RunFailed, {
        error: String(err),
      });

      process.exit(1);
    } finally {
      services.close();
    }
  });
