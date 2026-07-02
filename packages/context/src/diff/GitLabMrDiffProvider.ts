// packages/context/src/diff/GitLabMrDiffProvider.ts
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";
import { HttpDiffClient, type AuthHeader } from "./httpDiffClient.js";
import type { DiffProvider } from "@prsense/core";

type LoadResult = Awaited<ReturnType<DiffProvider["load"]>>;

// Typed boundary against the GitLab REST API. Keys are snake_case as GitLab
// returns them (no client-side camelization).
type GitLabMrResponse = {
  title?: string | null;
  description?: string | null;
  sha?: string | null;
  source_branch?: string | null;
  diff_refs?: { base_sha?: string | null } | null;
};

type GitLabChange = {
  old_path?: string | null;
  new_path?: string | null;
  diff?: string;
};

type GitLabChangesResponse = { changes?: GitLabChange[] };

export class GitLabMrDiffProvider implements DiffProvider {
  private cachedLoad?: Promise<LoadResult>;
  private readonly http: HttpDiffClient;

  constructor(
    private readonly group: string,
    private readonly project: string,
    private readonly mrNumber: string,
    token?: string,
    fetchImpl?: typeof fetch,
    host: string = "gitlab.com",
  ) {
    // Single-encode the "group/project" id exactly once. The SDK used to
    // double-encode this via its own encoder on top of ours.
    const auth: AuthHeader = token
      ? { name: "PRIVATE-TOKEN", value: token }
      : undefined;
    this.http = new HttpDiffClient(
      `https://${host}/api/v4`,
      auth,
      fetchImpl ?? fetch,
    );
  }

  private get mrPath(): string {
    const id = encodeURIComponent(`${this.group}/${this.project}`);
    return `/projects/${id}/merge_requests/${this.mrNumber}`;
  }

  private async fetchMetadata() {
    try {
      const res = await this.http.get(this.mrPath);
      const data = (await res.json()) as GitLabMrResponse;
      return {
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        revision: data.sha ?? undefined,
        baseRevision: data.diff_refs?.base_sha ?? undefined,
        branchName: data.source_branch ?? undefined,
      };
    } catch {
      return {};
    }
  }

  private async fetchDiff(): Promise<string> {
    // NOTE: /changes is deprecated (GitLab API v5 removal). Kept for broad
    // self-hosted compatibility; migrate to /diffs (paginated) in v1.1.
    const res = await this.http.get(`${this.mrPath}/changes`);
    const data = (await res.json()) as GitLabChangesResponse;
    const changes = data.changes ?? [];

    return changes
      .map((c) => {
        const oldPath = c.old_path ?? c.new_path ?? "unknown";
        const newPath = c.new_path ?? c.old_path ?? "unknown";
        return [
          `diff --git a/${oldPath} b/${newPath}`,
          `--- a/${oldPath}`,
          `+++ b/${newPath}`,
          c.diff ?? "",
        ].join("\n");
      })
      .join("\n");
  }

  async load(): Promise<LoadResult> {
    if (!this.cachedLoad) this.cachedLoad = this._load();
    return this.cachedLoad;
  }

  private async _load(): Promise<LoadResult> {
    const [metadata, diffText] = await Promise.all([
      this.fetchMetadata(),
      this.fetchDiff(),
    ]);
    return {
      diff: parseUnifiedDiff(diffText),
      revision: metadata.revision ?? "unknown",
      baseRevision: metadata.baseRevision ?? "unknown",
      repositoryIdentity: {
        provider: "gitlab",
        id: `${this.group}/${this.project}`,
      },
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
