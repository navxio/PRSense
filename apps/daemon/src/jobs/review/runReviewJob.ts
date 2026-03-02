// apps/daemon/src/jobs/review/runReviewJob.ts
import { runReviewWorkflow } from "@prsense/workflows";
import { createEventBus } from "@prsense/core";
import {
  LocalGitDiffProvider,
  GitHubPrDiffProvider,
  GitLabMrDiffProvider,
} from "@prsense/context";
import type {
  ResolvedConfig,
  CredentialContext,
} from "@prsense/runtime-config";
import type { Logger } from "@prsense/logging";
import type { ReviewJobInput } from "./types.js";
import { createReporter } from "@prsense/reporters";

export async function runReviewJob(
  input: ReviewJobInput,
  config: ResolvedConfig,
  credentials: CredentialContext,
  logger: Logger,
) {
  const eventBus = createEventBus((event) => {
    logger.info("domain.event", {
      event: event.event,
      fields: event.fields,
    });
  });

  let diffProvider;

  // -------------------------------------------------
  // Determine Provider
  // -------------------------------------------------

  const githubMatch = input.target.match(
    /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
  );

  if (githubMatch) {
    const owner = githubMatch[1];
    const repo = githubMatch[2];
    const pr = githubMatch[3];

    if (!owner || !repo || !pr) {
      throw new Error("Invalid GitHub PR URL");
    }

    diffProvider = new GitHubPrDiffProvider(
      owner,
      repo.replace(".git", ""),
      pr,
    );
  } else {
    const gitlabMatch = input.target.match(
      /gitlab\.com\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/,
    );

    if (gitlabMatch) {
      const group = gitlabMatch[1];
      const project = gitlabMatch[2];
      const mr = gitlabMatch[3];

      if (!group || !project || !mr) {
        throw new Error("Invalid GitLab MR URL");
      }

      diffProvider = new GitLabMrDiffProvider(
        group,
        project.replace(".git", ""),
        mr,
      );
    } else {
      // Fallback: local repository
      diffProvider = new LocalGitDiffProvider(input.target, input.baseBranch);
    }
  }

  // -------------------------------------------------
  // Execute Review Workflow
  // -------------------------------------------------

  const result = await runReviewWorkflow({
    config,
    credentials,
    diffProvider,
    eventBus,
  });

  // -------------------------------------------------
  // Delivery (Daemon Mode Only)
  // -------------------------------------------------

  if (
    result.outcome === "success" &&
    config.mode === "daemon" &&
    "delivery" in config &&
    result.payload.signals.length > 0
  ) {
    const vcs = config.delivery.vcs;

    const reporter = createReporter(vcs, credentials);

    if (!reporter) {
      logger.warn("delivery.reporter_not_available", {
        provider: vcs,
      });
    } else {
      try {
        await reporter.deliver(result.payload.signals, {
          targetUrl: input.target,
          repositoryProvider: vcs,
        });

        logger.info("delivery.completed", {
          provider: vcs,
          signalCount: result.payload.signals.length,
        });
      } catch (err) {
        logger.error("delivery.failed", {
          provider: vcs,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return result;
}
