// apps/cli/src/commands/review.ts
import { Command } from "commander";
import { runReviewWorkflow } from "@prsense/workflows";
import { createPinoLogger, logEvent } from "@prsense/logging";
import { createEventBus, CoreEvents } from "@prsense/core";
import {
  resolveConfig,
  validateResolvedConfig,
  buildCredentialContext,
  validateCredentialContext,
} from "@prsense/runtime-config";
import {
  loadGlobalConfig,
  loadRepoConfig,
  mergeUserConfigs,
  loadEnvConfig,
} from "@prsense/config";

import { createSpinnerRenderer } from "../ui/spinnerRenderer.js";
import { eventToCliTask } from "../ui/eventToTask.js";
import { stdoutConfigReporter } from "../reporting/stdoutConfigReporter.js";
import path from "node:path";
import {
  LocalGitDiffProvider,
  GitHubPrDiffProvider,
  GitLabMrDiffProvider,
} from "@prsense/context";

export const reviewCommand = new Command("review")
  .argument("[target]", "Path to repository", ".")
  .option("--base-branch <branch>", "Base branch to diff against")
  .action(async (target, options) => {
    const env = loadEnvConfig();

    const logger = createPinoLogger({
      level: env.PRSENSE_LOG_LEVEL ?? "warn",
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

      const globalConfig = loadGlobalConfig();
      const repoConfig = loadRepoConfig(process.cwd());
      const user = mergeUserConfigs(globalConfig, repoConfig);
      const env = loadEnvConfig();

      const credentialContext = buildCredentialContext(env);

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
      const resolved = resolveConfig({
        mode: "cli",
        repoRoot,
        repoProvider,
        user,
        env,
      });

      const domainValidation = validateResolvedConfig(resolved);
      const credentialIssues = validateCredentialContext(
        resolved,
        credentialContext,
      );

      const issues = [...domainValidation.issues, ...credentialIssues];

      if (issues.some((i) => i.level === "error")) {
        eventBus.emit(CoreEvents.RunFailed, {
          reason: "invalid-config",
        });

        await stdoutConfigReporter(issues);
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

      const result = await runReviewWorkflow({
        config: resolved,
        credentials: credentialContext,
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
