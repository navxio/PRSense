// packages/context/src/diff/CodebergPrDiffProvider.ts
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";
import type {
  DiffProvider,
  UnifiedDiff,
  RepositoryIdentity,
} from "@prsense/core";

type LoadResult = {
  diff: UnifiedDiff;
  revision: string;
  repositoryIdentity: RepositoryIdentity;
  metadata?: { title?: string; description?: string; branchName?: string };
};

const RETRYABLE = new Set([502, 503, 504]);

type ForgejoPullResponse = {
  title?: string | null;
  body?: string | null;
  head?: { sha?: string; ref?: string };
};

export class CodebergPrDiffProvider implements DiffProvider {
  private cachedLoad?: Promise<LoadResult>;
  private readonly apiBase: string;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly prNumber: string,
    private readonly token?: string,
    host: string = "codeberg.org",
  ) {
    this.apiBase = `https://${host}/api/v1`;
  }

  private async request(
    path: string,
    accept = "application/json",
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: accept };
    if (this.token) headers.Authorization = `token ${this.token}`;
    return this.retry(() => fetch(`${this.apiBase}${path}`, { headers }));
  }

  private async retry(
    fn: () => Promise<Response>,
    attempts = 4,
  ): Promise<Response> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fn();
        if (res.ok) return res;
        if (!RETRYABLE.has(res.status)) {
          throw new Error(`Codeberg API ${res.status}: ${await res.text()}`);
        }
        lastError = new Error(`Codeberg API ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
    throw lastError;
  }

  private async fetchMetadata() {
    try {
      const res = await this.request(
        `/repos/${this.owner}/${this.repo}/pulls/${this.prNumber}`,
      );
      const data = (await res.json()) as ForgejoPullResponse;
      return {
        title: data.title ?? undefined,
        description: data.body ?? undefined,
        revision: data.head?.sha as string | undefined,
        branchName: data.head?.ref ?? undefined,
      };
    } catch {
      return {};
    }
  }

  private async fetchDiff(): Promise<string> {
    const res = await this.request(
      `/repos/${this.owner}/${this.repo}/pulls/${this.prNumber}.diff`,
      "text/plain",
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
      repositoryIdentity: {
        provider: "codeberg",
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
