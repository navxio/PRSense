// apps/cli/src/commands/review.ts
import { Command } from "commander";
import { runReviewWorkflow, runIndexWorkflow } from "@prsense/workflows";
import { createPinoLogger, logEvent, LogLevel } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import { resolveEnvironment, ValidationIssue } from "@prsense/config";
import { validateReviewEffectiveConfig } from "./validation/review.js";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter, printStats } from "@prsense/reporters";
import path from "node:path";
import {
  LocalGitDiffProvider,
  GitHubPrDiffProvider,
  GitLabMrDiffProvider,
} from "@prsense/context";
import { buildOverrides, applyOverrides } from "../shared/configOverride.js";
import { ensureInit } from "./init/ensureInit.js";

import pkg from "../../package.json" with { type: "json" };
import { buildServices } from "../composition.js";

const PRSENSE_VERSION = pkg.version;

export const reviewCommand = new Command("review")
  .argument("[target]", "Path to repository", ".")
  .option("-b, --base-branch <branch>", "Base branch to diff against")
  .option("-n, --max-signals <n>", "Maximum number of signals requested")
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

      const repoRoot = path.resolve(target);

      const githubPrMatch = target.match(
        /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
      );
      const gitlabMrMatch = target.match(
        /gitlab\.com\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/,
      );

      const repoProvider = githubPrMatch
        ? "github"
        : gitlabMrMatch
          ? "gitlab"
          : "filesystem";

      const env = resolveEnvironment("cli", {
        root: repoRoot,
        provider: repoProvider,
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

      const cliIssues = validateReviewEffectiveConfig(
        effectiveConfig,
        env.credentials,
      );

      if (cliIssues.some((i: ValidationIssue) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-cli-config",
        });

        await stdoutConfigReporter.report({ issues: cliIssues });
        process.exit(1);
      }

      // -------------------------------------------------
      // Auto-index (incremental)
      // -------------------------------------------------

      if (options.autoIndex) {
        try {
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

      let diffProvider;

      if (githubPrMatch) {
        const [, owner, repo, prNumber] = githubPrMatch;

        diffProvider = new GitHubPrDiffProvider(
          owner,
          repo.replace(".git", ""),
          prNumber,
        );
      } else if (gitlabMrMatch) {
        const [, group, project, mrNumber] = gitlabMrMatch;

        diffProvider = new GitLabMrDiffProvider(
          group,
          project.replace(".git", ""),
          mrNumber,
        );
      } else {
        diffProvider = new LocalGitDiffProvider(
          repoRoot,
          effectiveConfig.git?.baseBranch,
        );
      }

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
        console.log("✔ No review signals (change looks safe)");
        process.exit(0);
      }

      const signals = result.payload.signals;
      for (const signal of signals) {
        console.log(`\n[${signal.severity.toUpperCase()}] ${signal.file}`);
        console.log(signal.message);

        if (signal.rationale) {
          console.log(`  ↳ ${signal.rationale}`);
        }

        if (signal.suggestedFix) {
          console.log(`  💡 ${signal.suggestedFix}`);
        }
      }

      console.log(
        `\n${result.payload.signals.length} of ${result.payload.totalSignalCount} signal(s) shown`,
      );

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
