// packages/context/src/diff/GitLabMrDiffProvider.ts
import { Gitlab } from "@gitbeaker/rest";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";

import type { DiffProvider, RepositoryIdentity } from "@prsense/core";

type GitLabChange = {
  old_path: string | null;
  new_path: string | null;
  diff: string;
};

const RETRYABLE = new Set([502, 503, 504]);

export class GitLabMrDiffProvider implements DiffProvider {
  private readonly api: InstanceType<typeof Gitlab>;
  private cachedLoad?: Promise<Awaited<ReturnType<DiffProvider["load"]>>>;

  constructor(
    private readonly group: string,
    private readonly project: string,
    private readonly mrNumber: string,
    token?: string,
  ) {
    this.api = new Gitlab({
      host: "https://gitlab.com",
      token,
    });
  }

  private projectId(): string {
    return encodeURIComponent(`${this.group}/${this.project}`);
  }

  private async retry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
    let lastError: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;

        const status =
          err?.cause?.response?.status ?? err?.response?.status ?? err?.status;

        if (!RETRYABLE.has(status)) {
          throw err;
        }

        const delay = 300 * 2 ** i;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError;
  }

  private async fetchMetadata(): Promise<{
    title?: string;
    description?: string;
    revision?: string;
    branchName?: string;
    baseRevision?: string;
  }> {
    try {
      const mr = await this.retry(() =>
        this.api.MergeRequests.show(this.projectId(), Number(this.mrNumber)),
      );

      const metadata: {
        title?: string;
        description?: string;
        revision?: string;
        branchName?: string;
        baseRevision?: string;
      } = {};

      // GitLab returns string | null
      if (mr.title != null) metadata.title = mr.title;
      if (mr.description != null) metadata.description = mr.description;
      if (mr.sha != null) metadata.revision = mr.sha;
      const diffRefs = mr.diffRefs as { baseSha?: string } | undefined;
      if (diffRefs?.baseSha != null) {
        metadata.baseRevision = diffRefs.baseSha;
      }
      if (typeof mr.source_branch === "string") {
        metadata.branchName = mr.source_branch;
      }

      return metadata;
    } catch {
      return {};
    }
  }

  private async fetchDiff(): Promise<string> {
    const res = await this.retry(() =>
      this.api.MergeRequests.showChanges(
        this.projectId(),
        Number(this.mrNumber),
      ),
    );

    const changes = (res.changes ?? []) as GitLabChange[];

    const unified = changes
      .map((c: GitLabChange) => {
        const oldPath = c.old_path ?? c.new_path ?? "unknown";
        const newPath = c.new_path ?? c.old_path ?? "unknown";

        return [
          `diff --git a/${oldPath} b/${newPath}`,
          `--- a/${oldPath}`,
          `+++ b/${newPath}`,
          c.diff,
        ].join("\n");
      })
      .join("\n");

    return unified;
  }

  async load() {
    if (!this.cachedLoad) this.cachedLoad = this._load();
    return this.cachedLoad;
  }

  private async _load() {
    const [metadata, diffText] = await Promise.all([
      this.fetchMetadata(),
      this.fetchDiff(),
    ]);

    const identity: RepositoryIdentity = {
      provider: "gitlab",
      id: `${this.group}/${this.project}`,
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
