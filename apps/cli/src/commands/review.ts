// apps/cli/src/commands/review.ts
import { Command } from "commander";
import { runReviewWorkflow } from "@prsense/workflows";
import { createPinoLogger, logEvent, LogLevel } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import { resolveEnvironment } from "@prsense/config";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter, printStats } from "@prsense/reporters";
import path from "node:path";
import {
  LocalGitDiffProvider,
  GitHubPrDiffProvider,
  GitLabMrDiffProvider,
} from "@prsense/context";

export const reviewCommand = new Command("review")
  .argument("[target]", "Path to repository", ".")
  .option("--base-branch <branch>", "Base branch to diff against")
  .option("--stats", "Print Stats related to review")
  .action(async (target, options) => {
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

      // -------------------------------------------------
      // Create Diff Provider
      // -------------------------------------------------

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
        diffProvider = new LocalGitDiffProvider(repoRoot, options.baseBranch);
      }

      // -------------------------------------------------
      // Run Review Workflow
      // -------------------------------------------------

      const start = Date.now();

      const result = await runReviewWorkflow({
        config: env.config,
        credentials: env.credentials,
        diffProvider,
        eventBus,
      });

      const durationMs = Date.now() - start;

      if (options.stats) {
        const validFiles = new Set(result.payload?.diffSummary?.files ?? []);

        printStats({
          outcome: result.outcome,
          signals: result.payload?.signals ?? [],
          usage: result.payload?.usage,
          durationMs,
          model: {
            provider: env.config.llm.provider,
            name: env.config.llm.model,
          },
          context: {
            indexing: {
              enabled: true,
              provider: env.config.embeddings.provider,
              model: env.config.embeddings.model,
            },
          },
          diff: {
            validFiles,
          },
        });
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
