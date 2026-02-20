// packages/context/src/diff/LocalGitDiffProvider.ts

import { execSync } from "node:child_process";
import path from "node:path";
import type { UnifiedDiff, DiffProvider } from "@prsense/core";
import { parseUnifiedDiff } from "./parseUnifiedDiff.js";

export class LocalGitDiffProvider implements DiffProvider {
  constructor(
    private readonly repoRoot: string,
    private readonly baseBranch?: string,
  ) {}

  async load() {
    const cwd = path.resolve(this.repoRoot);

    const diffCommand = this.baseBranch
      ? `git diff ${this.baseBranch}`
      : `git diff`;

    const diffText = execSync(diffCommand, {
      cwd,
      encoding: "utf8",
    });

    const revision = execSync("git rev-parse HEAD", {
      cwd,
      encoding: "utf8",
    }).trim();

    const diff: UnifiedDiff = parseUnifiedDiff(diffText);

    return {
      diff,
      revision,
      repositoryIdentity: {
        provider: "filesystem",
        id: cwd,
      },
    };
  }
}
