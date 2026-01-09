import { Command } from "commander";
import { selectAdapter } from "./selectAdapter.js";

import { review } from "@prsense/engine";
import { loadPrsenseConfig } from "@prsense/config";
import { buildReviewContext } from "@prsense/context";

import { summarize, printResult } from "./util.js";

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
      repoRoot: path,
      baseBranch,
      diffPath: options.diffPath,
      owner: options.owner,
      repo: options.repo,
      pullNumber: options.pullNumber ? Number(options.pullNumber) : undefined,
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

    printResult(summarize(signals));
  });
