// packages/context/src/diff/GitHubPrDiffProvider.ts
import { Octokit } from "@octokit/rest";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";

import type { DiffProvider, RepositoryIdentity } from "@prsense/core";

type LoadResult = Awaited<ReturnType<DiffProvider["load"]>>;

export class GitHubPrDiffProvider implements DiffProvider {
  private readonly octokit: Octokit;

  private cachedLoad?: Promise<LoadResult>;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly prNumber: string,
    token?: string,
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  private async retry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;

        const status = err?.status;

        if (![502, 503, 504].includes(status)) {
          throw err;
        }

        const delay = 300 * 2 ** i;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError;
  }

  private async fetchMetadata() {
    try {
      const { data } = await this.retry(() =>
        this.octokit.rest.pulls.get({
          owner: this.owner,
          repo: this.repo,
          pull_number: Number(this.prNumber),
        }),
      );

      return {
        title: data.title ?? undefined,
        description: data.body ?? undefined,
        revision: data.head?.sha,
        branchName: data.head?.ref ?? undefined,
        baseRevision: data.base?.sha,
      };
    } catch {
      return {};
    }
  }

  private async fetchDiff(): Promise<string> {
    const { data } = await this.retry(() =>
      this.octokit.rest.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: Number(this.prNumber),
        mediaType: { format: "diff" },
      }),
    );

    return data as unknown as string;
  }

  async load(): Promise<LoadResult> {
    if (!this.cachedLoad) {
      this.cachedLoad = this._load();
    }

    return this.cachedLoad;
  }

  private async _load(): Promise<LoadResult> {
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
      baseRevision: metadata.baseRevision ?? "unknown",
      repositoryIdentity: identity,
      metadata: {
        ...(metadata.title !== undefined && { title: metadata.title }),
        ...(metadata.description !== undefined && {
          description: metadata.description,
        }),
        ...(metadata.branchName !== undefined && {
          branchName: metadata.branchName,
        }),
      },
    };
  }
}
