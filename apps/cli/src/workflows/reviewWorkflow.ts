// cli/src/workflow/reviewWorkflow.ts
import { review } from "@prsense/engine";
import { loadUserConfig, loadEnvConfig } from "@prsense/config";
import { buildReviewContext } from "@prsense/context";
import { stdoutReporter } from "@prsense/reporters";

import { runTask } from "@prsense/engine";
import { Tasks } from "@prsense/domain";
import { createTaskRunner } from "@prsense/reporters";

import { selectAdapter } from "../runtime/selectAdapter.js";

type ReviewWorkflowInput = {
  repoPath: string;
  options: {
    source: "git" | "fs" | "github";
    baseBranch?: string;
    diffPath?: string;
    owner?: string;
    repo?: string;
    pullNumber?: string;
  };
};

export async function runReviewWorkflow(
  input: ReviewWorkflowInput,
): Promise<number> {
  const ui = createTaskRunner();

  try {
    // 1. Load configuration
    const { userConfig, envConfig } = await runTask(
      ui,
      Tasks.loadConfig(),
      async () => {
        return {
          userConfig: loadUserConfig(process.cwd()),
          envConfig: loadEnvConfig(process.env),
        };
      },
    );

    const baseBranch = input.options.baseBranch ?? userConfig.git.baseBranch;

    // 2. Select adapter
    const adapter = await runTask(ui, Tasks.selectAdapter(), async () => {
      return selectAdapter({
        source: input.options.source,
        repoRoot: input.repoPath,
        baseBranch,

        ...(input.options.diffPath && {
          diffPath: input.options.diffPath,
        }),

        ...(input.options.owner && {
          owner: input.options.owner,
        }),

        ...(input.options.repo && {
          repo: input.options.repo,
        }),

        ...(input.options.pullNumber && {
          pullNumber: input.options.pullNumber,
        }),

        token: envConfig.PRSENSE_GITHUB_TOKEN,
      });
    });

    // 3. Ingest diff
    const diffResult = await runTask(ui, Tasks.ingestDiff(), async () => {
      return adapter();
    });

    if (!diffResult.ok) {
      throw new Error(diffResult.error.message);
    }

    // 4. Build review context
    const context = await runTask(ui, Tasks.buildContext(), async () => {
      return buildReviewContext(diffResult.value, {
        maxChunks: userConfig.context.maxChunks,
      });
    });

    // 5. Run review engine
    const signals = await runTask(ui, Tasks.runReviewEngine(), async () => {
      return review(context, {
        confidenceThreshold: userConfig.review.confidenceThreshold,
        maxSignals: userConfig.review.maxSignals,
      });
    });

    // 6. Report results (intentionally NOT animated)
    await stdoutReporter(signals);

    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Unexpected error");
    return 1;
  }
}
