import { review } from "@prsense/engine";
import { loadUserConfig, loadEnvConfig } from "@prsense/config";
import { buildReviewContext } from "@prsense/context";
import { stdoutReporter } from "@prsense/reporters";

import { selectAdapter } from "../adapters/selectAdapter.js";

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
  try {
    // 1. Load configuration
    const userConfig = loadUserConfig(process.cwd());
    const envConfig = loadEnvConfig(process.env);

    const baseBranch = input.options.baseBranch ?? userConfig.git.baseBranch;

    // 2. Select adapter
    const adapter = selectAdapter({
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

    // 3. Ingest diff
    const result = await adapter();

    if (!result.ok) {
      console.error(result.error.message);
      return 1;
    }

    // 4. Build review context
    const context = await buildReviewContext(result.value, {
      maxChunks: userConfig.context.maxChunks,
    });

    // 5. Run review engine
    const signals = review(context, {
      confidenceThreshold: userConfig.review.confidenceThreshold,
      maxSignals: userConfig.review.maxSignals,
    });

    // 6. Report results
    await stdoutReporter(signals);

    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Unexpected error");
    return 1;
  }
}
