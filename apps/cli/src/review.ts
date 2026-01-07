import { Command } from "commander";
import { review } from "@prsense/engine";
import { ReviewContext } from "@prsense/domain";
import { loadPrsenseConfig } from "@prsense/config";
import { getGitDiff } from "./git.js";
import { summarize, printResult } from "./util.js";
import { parseUnifiedDiff } from "./diff.js";

export const reviewCommand = new Command("review")
  .argument("[path]", "Path to repository", ".")
  .option("--base-branch <branch>", "Base branch to diff against")
  .action(async (path, options) => {
    const config = loadPrsenseConfig(process.cwd());

    const baseBranch = options.baseBranch ?? config.git?.baseBranch ?? "main";

    const diffText = await getGitDiff(path, baseBranch);
    const unifiedDiff = parseUnifiedDiff(diffText);

    if (unifiedDiff.files.length === 0) {
      console.log(
        `No changes detected.\n` +
          `Hint: switch to a feature branch or make local changes.`,
      );
      return;
    }

    const ctx: ReviewContext = {
      repoRoot: path,
      baseBranch,
      diff: unifiedDiff,
    };

    const signals = review(ctx, {
      enabledRuleIds: config.rules?.enable ?? [],
    });

    printResult(summarize(signals));
  });
