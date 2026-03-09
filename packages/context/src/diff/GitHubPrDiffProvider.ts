import { Octokit } from "@octokit/rest";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";

import type {
  DiffProvider,
  UnifiedDiff,
  RepositoryIdentity,
} from "@prsense/core";

export class GitHubPrDiffProvider implements DiffProvider {
  private readonly octokit: Octokit;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly prNumber: string,
    token?: string,
  ) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  private async fetchMetadata() {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: Number(this.prNumber),
      });

      return {
        title: data.title ?? undefined,
        description: data.body ?? undefined,
        revision: data.head?.sha,
      };
    } catch {
      return {};
    }
  }

  private async fetchDiff(): Promise<string> {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: Number(this.prNumber),
      mediaType: {
        format: "diff",
      },
    });

    // Octokit types this as `unknown` in this case
    return data as unknown as string;
  }

  async load(): Promise<{
    diff: UnifiedDiff;
    revision: string;
    repositoryIdentity: RepositoryIdentity;
    metadata?: {
      title?: string;
      description?: string;
    };
  }> {
    const [metadata, diffText] = await Promise.all([
      this.fetchMetadata(),
      this.fetchDiff(),
    ]);

    const identity: RepositoryIdentity = {
      provider: "github",
      id: `${this.owner}/${this.repo}`,
    };

    return {
      diff: parseUnifiedDiff(diffText),
      revision: metadata.revision ?? "unknown",
      repositoryIdentity: identity,
      metadata: {
        ...(metadata.title !== undefined && { title: metadata.title }),
        ...(metadata.description !== undefined && {
          description: metadata.description,
        }),
      },
    };
  }
}
