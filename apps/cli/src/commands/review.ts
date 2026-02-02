import { Command } from "commander";
import { runReviewWorkflow } from "@prsense/workflows";

export const reviewCommand = new Command("review")
  .argument("[path]", "Path to repository", ".")
  .option("--source <source>", "git | fs | github", "git")
  .option("--base-branch <branch>", "Base branch to diff against")
  .option("--diff-path <path>", "Diff file path (fs source)")
  .option("--owner <owner>", "GitHub repo owner")
  .option("--repo <repo>", "GitHub repo name")
  .option("--pull-number <number>", "GitHub pull request number")
  .action(async (path, options) => {
    const exitCode = await runReviewWorkflow({
      repoPath: path,
      options,
    });

    process.exit(exitCode);
  });
