import type { Adapter } from "../shared/types.js";
import type { AdapterResult } from "../shared/result.js";
import type { GitHubPullRequest } from "./githubTypes.js";
import type { ReviewInput } from "@prsense/domain";
export type GitHubAdapterOptions = {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
};

const GITHUB_API_BASE_URL = "https://api.github.com";

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

export function githubDiffAdapter(options: GitHubAdapterOptions): Adapter {
  const { owner, repo, pullNumber, token } = options;

  return async (): Promise<AdapterResult> => {
    try {
      // 1. Fetch PR metadata
      const prRes = await githubFetch(
        `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/pulls/${pullNumber}`,
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

      const pr = (await prRes.json()) as GitHubPullRequest;

      // 2. Fetch unified diff
      const diffRes = await githubFetch(
        `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/pulls/${pullNumber}`,
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
      const metadata: ReviewInput["metadata"] = {};

      if (pr.title) {
        metadata.title = pr.title;
      }

      if (pr.body) {
        metadata.description = pr.body;
      }

      if (pr.user?.login) {
        metadata.author = pr.user.login;
      }

      const value: ReviewInput = {
        repo: {
          owner,
          name: repo,
        },
        baseBranch: pr.base?.ref,
        diffText,
      };
      if (Object.keys(metadata).length > 0) {
        value.metadata = metadata;
      }
      // 3. Normalize into ReviewInput
      return {
        ok: true,
        value,
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
