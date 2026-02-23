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

export class GitLabMrDiffProvider implements DiffProvider {
  constructor(
    private readonly group: string,
    private readonly project: string,
    private readonly mrNumber: string,
    private readonly token?: string,
  ) {}

  private async cloneTemp(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-mr-"));

    const cloneUrl = this.token
      ? `https://${this.token}@gitlab.com/${this.group}/${this.project}.git`
      : `https://gitlab.com/${this.group}/${this.project}.git`;

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

    // Fetch MR branch
    execSync(
      `git fetch origin merge-requests/${this.mrNumber}/head:prsense-mr-${this.mrNumber}`,
      { cwd: repoRoot, stdio: "ignore" },
    );

    // Diff against default branch (origin/HEAD)
    const diffText = execSync(
      `git diff origin/HEAD...prsense-mr-${this.mrNumber}`,
      { cwd: repoRoot, encoding: "utf8" },
    );

    const revision = execSync(`git rev-parse prsense-mr-${this.mrNumber}`, {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    const identity: RepositoryIdentity = {
      provider: "gitlab",
      id: `${this.group}/${this.project}`,
    };

    return {
      diff: parseUnifiedDiff(diffText),
      revision,
      repositoryIdentity: identity,
    };
  }
}
