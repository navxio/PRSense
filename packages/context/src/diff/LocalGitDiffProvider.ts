// packages/context/src/diff/LocalGitDiffProvider.ts

import { execSync } from "node:child_process";
import path from "node:path";
import type { UnifiedDiff, DiffProvider } from "@prsense/core";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";
import { RepositoryIdentity } from "@prsense/core";

export class LocalGitDiffProvider implements DiffProvider {
  constructor(
    private readonly repoRoot: string,
    private readonly baseBranch?: string,
  ) {}

  async load() {
    const cwd = path.resolve(this.repoRoot);

    const hasUncommittedChanges =
      execSync("git status --porcelain", { cwd, encoding: "utf8" }).trim()
        .length > 0;

    let diffText = "";
    let mode: "working-tree" | "branch" = "working-tree";

    if (hasUncommittedChanges) {
      diffText = execSync("git diff", {
        cwd,
        encoding: "utf8",
      });
    } else {
      const baseBranch =
        this.baseBranch ??
        execSync("git symbolic-ref refs/remotes/origin/HEAD", {
          cwd,
          encoding: "utf8",
        })
          .trim()
          .split("/")
          .pop();

      if (!baseBranch) {
        throw new Error("Unable to determine base branch");
      }

      diffText = execSync(`git diff ${baseBranch}...HEAD`, {
        cwd,
        encoding: "utf8",
      });

      mode = "branch";
    }

    const revision = execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();

    const diff: UnifiedDiff = parseUnifiedDiff(diffText);

    const identity: RepositoryIdentity = {
      provider: "filesystem",
      id: cwd,
    };

    const branchName = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();

    return {
      diff,
      revision,
      repositoryIdentity: identity,
      metadata: {
        branchName,
      },
    };
  }
}
