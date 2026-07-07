// apps/cli/src/shared/findRepoRoot.ts
import { execFileSync } from "node:child_process";
export function findRepoRoot(start: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: start,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"], // silence git stderr
    }).trim();
  } catch {
    throw new Error(`Not a git repository: ${start}`);
  }
}
