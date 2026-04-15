// packages/context/src/diff/LocalGitDiffProvider.ts

import { execSync } from "node:child_process";
import path from "node:path";
import type { UnifiedDiff, DiffProvider } from "@prsense/core";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";
import { RepositoryIdentity } from "@prsense/core";

function getBranchName(cwd: string): string | undefined {
  try {
    const raw = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();

    // Detached HEAD → not a real branch
    if (!raw || raw === "HEAD") {
      return undefined;
    }

    return raw;
  } catch {
    return undefined;
  }
}

export class LocalGitDiffProvider implements DiffProvider {
  constructor(
    private readonly repoRoot: string,
    private readonly baseBranch?: string,
  ) { }

  async load() {
    const cwd = path.resolve(this.repoRoot);

    // -------------------------------------------------
    // Resolve base branch
    // -------------------------------------------------

    let baseBranch;

    try {
      baseBranch =
        this.baseBranch ??
        execSync("git symbolic-ref refs/remotes/origin/HEAD", {
          cwd,
          encoding: "utf8",
        })
          .trim()
          .split("/")
          .pop();
    } catch {
      baseBranch = "main"; // fallback
    }

    // -------------------------------------------------
    // Compute diff
    // -------------------------------------------------

    const hasUncommittedChanges =
      execSync("git status --porcelain", { cwd, encoding: "utf8" }).trim().length > 0;

    let diffText = "";

    if (hasUncommittedChanges) {
      // FULL current state vs base
      diffText = execSync(`git diff ${baseBranch}`, {
        cwd,
        encoding: "utf8",
      });
    } else {
      // clean branch diff
      diffText = execSync(`git diff ${baseBranch}...HEAD`, {
        cwd,
        encoding: "utf8",
      });
    }

    // -------------------------------------------------
    // Parse diff
    // -------------------------------------------------

    const diff: UnifiedDiff = parseUnifiedDiff(diffText);

    // -------------------------------------------------
    // Revision + metadata
    // -------------------------------------------------

    const revision = execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();

    const identity: RepositoryIdentity = {
      provider: "filesystem",
      id: cwd,
    };

    const branchName = getBranchName(cwd);

    return {
      diff,
      revision,
      repositoryIdentity: identity,
      metadata: {
        ...(branchName !== undefined && { branchName }),
      },
    };
  }
}
