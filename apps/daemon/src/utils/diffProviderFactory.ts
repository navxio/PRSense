// apps/daemon/src/jobs/utils/diffProviderFactory.ts
import { LocalGitDiffProvider } from "@prsense/context";
import { GitHubPrDiffProvider } from "@prsense/context";
import { GitLabMrDiffProvider } from "@prsense/context";

export async function createDiffProviderForTarget(
  target: string,
  baseBranch?: string,
) {
  const githubMatch = target.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  );

  if (githubMatch) {
    const [, owner, repo, prNumber] = githubMatch;
    return new GitHubPrDiffProvider(owner, repo, prNumber);
  }

  const gitlabMatch = target.match(
    /gitlab\.com\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/,
  );

  if (gitlabMatch) {
    const [, owner, repo, mrNumber] = gitlabMatch;
    return new GitLabMrDiffProvider(owner, repo, mrNumber);
  }

  return new LocalGitDiffProvider(target, baseBranch);
}
