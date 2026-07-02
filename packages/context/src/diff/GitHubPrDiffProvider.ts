// packages/context/src/diff/GitHubPrDiffProvider.ts
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";
import { HttpDiffClient, type AuthHeader } from "./httpDiffClient.js";
import type { DiffProvider } from "@prsense/core";

type LoadResult = Awaited<ReturnType<DiffProvider["load"]>>;

// Typed boundary against the GitHub REST API. An upstream shape change surfaces
// here, in one place, rather than scattered through the provider.
type GitHubPullResponse = {
  title?: string | null;
  body?: string | null;
  head?: { sha?: string; ref?: string };
  base?: { sha?: string };
};

export class GitHubPrDiffProvider implements DiffProvider {
  private cachedLoad?: Promise<LoadResult>;
  private readonly http: HttpDiffClient;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly prNumber: string,
    token?: string,
    fetchImpl?: typeof fetch,
  ) {
    const auth: AuthHeader = token
      ? { name: "Authorization", value: `Bearer ${token}` }
      : undefined;
    this.http = new HttpDiffClient(
      "https://api.github.com",
      auth,
      fetchImpl ?? fetch,
    );
  }

  private get pullPath(): string {
    return `/repos/${this.owner}/${this.repo}/pulls/${this.prNumber}`;
  }

  private async fetchMetadata() {
    try {
      const res = await this.http.get(this.pullPath);
      const data = (await res.json()) as GitHubPullResponse;
      return {
        title: data.title ?? undefined,
        description: data.body ?? undefined,
        revision: data.head?.sha,
        baseRevision: data.base?.sha,
        branchName: data.head?.ref ?? undefined,
      };
    } catch {
      return {};
    }
  }

  private async fetchDiff(): Promise<string> {
    const res = await this.http.get(
      this.pullPath,
      "application/vnd.github.v3.diff",
    );
    return res.text();
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
        provider: "github",
        id: `${this.owner}/${this.repo}`,
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
