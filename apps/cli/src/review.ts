import { Command } from "commander";
import { review } from "@prsense/engine";
import { ReviewContext } from "@prsense/domain";
import { summarize, printResult } from "./util.js";

export const reviewCommand = new Command("review")
  .argument("[path]", "Path to repository", ".")
  .option("--base-branch <branch>", "Base branch to diff against", "main")
  .description("Review changes in a repository")
  .action((path: string, options) => {
    // TEMPORARY: fake ReviewContext
    const ctx: ReviewContext = {
      repoRoot: path,
      baseBranch: options.baseBranch,
      diff: {
        files: [
          {
            path: "src/example.ts",
            patch: `
+ // TODO: handle edge case
+ function foo() {}
            `,
          },
        ],
      },
    };

    const signals = review(ctx, {
      enabledRuleIds: ["todo-detection"],
    });

    const result = summarize(signals);
    printResult(result);
  });
