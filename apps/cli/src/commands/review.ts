import { Command } from "commander";
import { selectAdapter } from "../selectAdapter.js";

import { review } from "@prsense/engine";
import { loadPrsenseConfig } from "@prsense/config";
import { stdoutReporter } from "@prsense/reporters";
import { buildReviewContext } from "@prsense/context";

export const reviewCommand = new Command("review")
  .argument("[path]", "Path to repository", ".")
  .option("--source <source>", "git | fs | github", "git")
  .option("--base-branch <branch>", "Base branch to diff against")
  .option("--diff-path <path>", "Diff file path (fs source)")
  .option("--owner <owner>", "GitHub repo owner")
  .option("--repo <repo>", "GitHub repo name")
  .option("--pull-number <number>", "GitHub pull request number")
  .action(async (path, options) => {
    const config = loadPrsenseConfig(process.cwd());

    const baseBranch = options.baseBranch ?? config.git?.baseBranch ?? "main";

    const adapter = selectAdapter({
      source: options.source,
      ...(options.pullNumber !== undefined && {
        pullNumber: options.pullNumber,
      }),
      ...(options.owner && { owner: options.owner }),
      ...(options.repo && { repo: options.repo }),
      ...(options.diffPath && { diffPath: options.diffPath }),
      ...(baseBranch && { baseBranch }),
      repoRoot: path,
      token: process.env.GITHUB_TOKEN,
    });

    const result = await adapter();

    if (!result.ok) {
      console.error(result.error.message);
      return;
    }

    const context = await buildReviewContext(result.value);

    const signals = review(context, {
      enabledRuleIds: config.rules?.enable ?? [],
    });

    await stdoutReporter(signals);
  });
