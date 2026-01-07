import { simpleGit } from "simple-git";

export async function getGitDiff(
  repoRoot: string,
  baseBranch: string,
): Promise<string> {
  const git = simpleGit(repoRoot);

  // sanity check
  if (!(await git.checkIsRepo())) {
    throw new Error("Not a git repository");
  }

  // baseBranch...HEAD = PR-style diff
  return git.diff([`${baseBranch}...HEAD`]);
}
