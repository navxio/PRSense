// apps/cli/src/shared/findRepoRoot.ts
import { execFileSync } from "node:child_process";

export function findRepoRoot(start: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: start,
      encoding: "utf8",
    }).trim();
  } catch {
    return start; // not a git repo; let downstream error naturally
  }
}
