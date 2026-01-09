import type { Adapter } from "@prsense/adapters";
import {
  filesystemAdapter,
  githubAdapter,
  gitAdapter,
} from "@prsense/adapters";

type CliOptions = {
  source: "git" | "fs" | "github";

  // common
  repoRoot?: string;
  baseBranch?: string;

  // filesystem
  diffPath?: string;

  // github
  owner?: string;
  repo?: string;
  pullNumber?: number;
  token?: string;
};

export function selectAdapter(opts: CliOptions): Adapter {
  switch (opts.source) {
    case "git": {
      if (!opts.repoRoot || !opts.baseBranch) {
        throw new Error("Git source requires --repo-root and --base-branch");
      }

      return gitAdapter({
        repoRoot: opts.repoRoot,
        baseBranch: opts.baseBranch,
      });
    }

    case "fs": {
      if (!opts.repoRoot || !opts.diffPath) {
        throw new Error(
          "Filesystem source requires --repo-root and --diff-path",
        );
      }

      return filesystemAdapter({
        repoRoot: opts.repoRoot,
        diffPath: opts.diffPath,
      });
    }

    case "github": {
      if (!opts.owner || !opts.repo || !opts.pullNumber || !opts.token) {
        throw new Error(
          "GitHub source requires --owner, --repo, --pull-number, and GITHUB_TOKEN",
        );
      }

      return githubAdapter({
        owner: opts.owner,
        repo: opts.repo,
        pullNumber: opts.pullNumber,
        token: opts.token,
      });
    }

    default: {
      const _exhaustive: never = opts.source;
      throw new Error(`Unknown source: ${_exhaustive}`);
    }
  }
}
