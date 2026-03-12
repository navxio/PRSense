export interface PRDetails {
  owner: string;
  repo: string;
  prNumber: number;
}

export function extractPRDetails(url: string): PRDetails {
  const PR_URL_REGEX =
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
  const match = url.match(PR_URL_REGEX);

  if (!match) {
    throw new Error(
      `Invalid GitHub PR URL: "${url}". Expected format: https://github.com/{owner}/{repo}/pull/{number}`,
    );
  }

  const [, owner, repo, pr] = match as [string, string, string, string];

  return {
    owner,
    repo,
    prNumber: parseInt(pr, 10),
  };
}
