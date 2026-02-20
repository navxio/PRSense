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

  private async cloneTemp(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-pr-"));

    const cloneUrl = this.token
      ? `https://${this.token}@github.com/${this.owner}/${this.repo}.git`
      : `https://github.com/${this.owner}/${this.repo}.git`;

    execSync(`git clone --depth 1 ${cloneUrl} ${tempDir}`, {
      stdio: "ignore",
    });

    return tempDir;
  }

  async load(): Promise<{
    diff: UnifiedDiff;
    revision: string;
    repositoryIdentity: RepositoryIdentity;
  }> {
    const repoRoot = await this.cloneTemp();

    // Fetch PR branch
    execSync(
      `git fetch origin pull/${this.prNumber}/head:prsense-pr-${this.prNumber}`,
      { cwd: repoRoot, stdio: "ignore" },
    );

    // Diff against default branch (origin/HEAD)
    const diffText = execSync(
      `git diff origin/HEAD...prsense-pr-${this.prNumber}`,
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
    };
  }
}
