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
  ) {}

  async load() {
    const cwd = path.resolve(this.repoRoot);

    // -------------------------------------------------
    // Resolve base branch
    // -------------------------------------------------
    let baseBranch: string | undefined;
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
      throw new Error("Could not determine base branch");
    }
    if (!baseBranch) {
      throw new Error("Could not determine base branch");
    }
    // -------------------------------------------------
    // Resolve base revision
    //
    // Prefer merge-base when both refs exist; on unborn HEAD or no
    // common ancestor, fall back to the base branch itself so diff
    // generation can still proceed (symbol-graph will see the
    // fallback as a bare ref, not a SHA, and skip cleanly).
    // -------------------------------------------------
    let baseRevision: string;
    try {
      baseRevision = execSync(`git merge-base ${baseBranch} HEAD`, {
        cwd,
        encoding: "utf8",
      }).trim();
    } catch {
      baseRevision = baseBranch;
    }
    // -------------------------------------------------
    // Compute diff
    // -------------------------------------------------
    const hasUncommittedChanges =
      execSync("git status --porcelain", { cwd, encoding: "utf8" }).trim()
        .length > 0;

    let diffText = "";
    if (hasUncommittedChanges) {
      diffText = execSync(`git diff ${baseRevision}`, {
        cwd,
        encoding: "utf8",
      });
    } else {
      diffText = execSync(`git diff ${baseRevision}..HEAD`, {
        cwd,
        encoding: "utf8",
      });
    }

    const diff: UnifiedDiff = parseUnifiedDiff(diffText);

    const revision = execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();

    const identity: RepositoryIdentity = { provider: "filesystem", id: cwd };
    const branchName = getBranchName(cwd);

    return {
      diff,
      revision,
      baseRevision, // NEW
      repositoryIdentity: identity,
      metadata: {
        ...(branchName !== undefined && { branchName }),
      },
    };
  }
}
