import { simpleGit } from "simple-git";

import type { Adapter } from "../shared/types.js";
import type { AdapterResult } from "../shared/result.js";

export type GitAdapterOptions = {
  repoRoot: string;
  baseBranch: string;
};

export function gitAdapter(options: GitAdapterOptions): Adapter {
  const { repoRoot, baseBranch } = options;

  return async (): Promise<AdapterResult> => {
    try {
      const git = simpleGit(repoRoot);

      // sanity check
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          ok: false,
          error: {
            kind: "InvalidInputError",
            message: "Not a git repository",
          },
        };
      }

      // PR-style diff
      const diffText = await git.diff([`${baseBranch}...HEAD`]);

      return {
        ok: true,
        value: {
          repo: {
            owner: "local",
            name: repoRoot.split("/").pop() ?? "repo",
          },
          repoRoot,
          baseBranch,
          diffText,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "IOError",
          message: "Failed to compute git diff",
          cause: err,
        },
      };
    }
  };
}
