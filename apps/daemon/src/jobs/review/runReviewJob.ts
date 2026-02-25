// apps/daemon/src/jobs/review/runReviewJob.ts
import { runReviewWorkflow } from "@prsense/workflows";
import { createEventBus } from "@prsense/core";
import { createDiffProviderForTarget } from "../utils/diffProviderFactory.js";
import type { ReviewJobInput, ReviewJobResult } from "./types.js";
import type { ResolvedConfig } from "@prsense/runtime-config";

export async function runReviewJob(
  config: ResolvedConfig,
  input: ReviewJobInput,
): Promise<ReviewJobResult> {
  const eventBus = createEventBus(() => {
    // optionally log
  });

  const diffProvider = await createDiffProviderForTarget(
    input.target,
    input.baseBranch,
  );

  return runReviewWorkflow({
    config,
    diffProvider,
    eventBus,
  });
}
