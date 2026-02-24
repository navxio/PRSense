import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";
import type {
  DiffProvider,
  UnifiedDiff,
  RepositoryIdentity,
} from "@prsense/core";

export class GitHubPrDiffProvider implements DiffProvider {
  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly prNumber: string,
    private readonly token?: string,
  ) {}

  private async fetchMetadata(): Promise<{
    title?: string;
    description?: string;
    baseRef?: string;
  }> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${this.owner}/${this.repo}/pulls/${this.prNumber}`,
        {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        },
      );

      if (!res.ok) {
        return {};
      }

      const json = (await res.json()) as {
        title?: string;
        body?: string;
        base?: { ref?: string };
      };

      const metadata: {
        title?: string;
        description?: string;
        baseRef?: string;
      } = {};

      if (json.title !== undefined) {
        metadata.title = json.title;
      }

      if (json.body !== undefined) {
        metadata.description = json.body;
      }

      if (json.base?.ref !== undefined) {
        metadata.baseRef = json.base.ref;
      }

      return metadata;
    } catch {
      return {};
    }
  }

  private async cloneTemp(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-pr-"));

    const cloneUrl = this.token
      ? `https://${this.token}@github.com/${this.owner}/${this.repo}.git`
      : `https://github.com/${this.owner}/${this.repo}.git`;

    execSync(`git clone --depth 50 ${cloneUrl} ${tempDir}`, {
      stdio: "ignore",
    });

    return tempDir;
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
    const repoRoot = await this.cloneTemp();

    // Fetch PR branch
    execSync(
      `git fetch origin pull/${this.prNumber}/head:prsense-pr-${this.prNumber}`,
      { cwd: repoRoot, stdio: "ignore" },
    );

    const metadata = await this.fetchMetadata();

    const baseBranch = metadata.baseRef ?? "main";

    // fetch base branch explicitly
    execSync(`git fetch origin ${baseBranch}`, {
      cwd: repoRoot,
      stdio: "ignore",
    });

    const diffText = execSync(
      `git diff origin/${baseBranch}...prsense-pr-${this.prNumber}`,
      { cwd: repoRoot, encoding: "utf8" },
    );

    const revision = execSync(`git rev-parse prsense-pr-${this.prNumber}`, {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    const identity: RepositoryIdentity = {
      provider: "github",
      id: `${this.owner}/${this.repo}`,
    };

    return {
      diff: parseUnifiedDiff(diffText),
      revision,
      repositoryIdentity: identity,
      metadata,
    };
  }
}
