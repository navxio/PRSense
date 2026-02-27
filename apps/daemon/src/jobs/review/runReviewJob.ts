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

    const diffProvider = new GitHubPrDiffProvider(
      owner,
      repo.replace(".git", ""),
      pr,
    );

    return runReviewWorkflow({
      config,
      credentials,
      diffProvider,
      eventBus,
    });
  }

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

    const diffProvider = new GitLabMrDiffProvider(
      group,
      project.replace(".git", ""),
      mr,
    );

    return runReviewWorkflow({
      config,
      credentials,
      diffProvider,
      eventBus,
    });
  }

  // Fallback: local repository
  const diffProvider = new LocalGitDiffProvider(input.target, input.baseBranch);

  return runReviewWorkflow({
    config,
    credentials,
    diffProvider,
    eventBus,
  });
}
