import type { Adapter } from "./types.js";
import type { AdapterResult } from "./result.js";
export type GitHubAdapterOptions = {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
};

const GITHUB_API = "https://api.github.com";

async function githubFetch(
  url: string,
  token: string,
  accept: string,
): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      "User-Agent": "prsense",
    },
  });
}

export function githubAdapter(options: GitHubAdapterOptions): Adapter {
  const { owner, repo, pullNumber, token } = options;

  return async (): Promise<AdapterResult> => {
    try {
      // 1. Fetch PR metadata
      const prRes = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}`,
        token,
        "application/vnd.github.v3+json",
      );

      if (prRes.status === 401 || prRes.status === 403) {
        return {
          ok: false,
          error: {
            kind: "AuthError",
            message: "GitHub authentication failed",
          },
        };
      }

      if (prRes.status === 404) {
        return {
          ok: false,
          error: {
            kind: "NotFoundError",
            message: "Pull request not found",
          },
        };
      }

      if (!prRes.ok) {
        return {
          ok: false,
          error: {
            kind: "UnknownError",
            message: `Failed to fetch PR metadata (${prRes.status})`,
          },
        };
      }

      const pr = await prRes.json();

      // 2. Fetch unified diff
      const diffRes = await githubFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}`,
        token,
        "application/vnd.github.v3.diff",
      );

      if (!diffRes.ok) {
        return {
          ok: false,
          error: {
            kind: "IOError",
            message: `Failed to fetch PR diff (${diffRes.status})`,
          },
        };
      }

      const diffText = await diffRes.text();

      // 3. Normalize into ReviewInput
      return {
        ok: true,
        value: {
          repo: {
            owner,
            name: repo,
          },
          baseBranch: pr.base?.ref,
          diffText,
          metadata: {
            title: pr.title,
            description: pr.body ?? "",
            author: pr.user?.login,
          },
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "UnknownError",
          message: "Unexpected error while fetching from GitHub",
          cause: err,
        },
      };
    }
  };
}
