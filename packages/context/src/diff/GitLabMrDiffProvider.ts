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
  private async fetchMetadata(): Promise<{
    title?: string;
    description?: string;
  }> {
    try {
      const encodedProject = encodeURIComponent(
        `${this.group}/${this.project}`,
      );

      const res = await fetch(
        `https://gitlab.com/api/v4/projects/${encodedProject}/merge_requests/${this.mrNumber}`,
        {
          headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        },
      );

      if (!res.ok) {
        return {};
      }

      const json = (await res.json()) as {
        title?: string;
        description?: string;
      };

      const metadata: {
        title?: string;
        description?: string;
      } = {};

      if (json.title !== undefined) {
        metadata.title = json.title;
      }

      if (json.description !== undefined) {
        metadata.description = json.description;
      }

      return metadata;
    } catch {
      return {};
    }
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
    const metadata = await this.fetchMetadata();

    return {
      diff: parseUnifiedDiff(diffText),
      revision,
      repositoryIdentity: identity,
      metadata,
    };
  }
}
