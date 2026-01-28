// packages/preflight/src/capabilities/gitRepository.ts
import { execFileSync } from "node:child_process";
import type { Capability } from "../types.js";

export const gitRepositoryCapability: Capability = {
  id: "git-repository",
  description: "Inside a Git repository",

  async check(ctx) {
    // 1️⃣ Check if git is available at all
    try {
      execFileSync("git", ["--version"], {
        stdio: "ignore",
      });
    } catch {
      return {
        kind: "missing",
        reason: "`git` command not found in PATH",
      };
    }

    // 2️⃣ Check if we are inside a git work tree
    try {
      execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: ctx.cwd,
        stdio: "ignore",
      });

      return { kind: "ready" };
    } catch {
      return {
        kind: "missing",
        reason: "Not inside a Git repository",
      };
    }
  },

  // no apply → not auto-fixable
};
