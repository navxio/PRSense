// packages/workflows/src/review/reviewWorkflow.ts

import { CoreEvents, EventBus } from "@prsense/core";
import type { DiffProvider } from "@prsense/core";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import type { ReviewWorkflowResult } from "./types.js";
import { loadDiff } from "./steps/loadDiff.js";
import { resolveContext } from "./steps/resolveContext.js";
import { createLlmClientSafe } from "./steps/createLlmClient.js";
import { runFileReview } from "./steps/runFileReview.js";
import { finalizeSignals } from "./steps/finaliseSignals.js";

export async function runReviewWorkflow({
  config,
  credentials,
  diffProvider,
  eventBus,
}: {
  config: ResolvedConfig;
  credentials: CredentialContext;
  diffProvider: DiffProvider;
  eventBus: EventBus;
}): Promise<ReviewWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowReviewStarted);

  let diffSummary: { files: string[] } | undefined;

  try {
    const {
      diff,
      revision,
      repositoryIdentity,
      metadata,
      diffSummary: summary,
    } = await loadDiff(diffProvider);

    diffSummary = summary;

    if (diff.files.length === 0) {
      return {
        outcome: "success",
        payload: { signals: [], diffSummary },
      };
    }

    const { contextText } = await resolveContext({
      config,
      repositoryIdentity,
      revision,
      metadata,
      diff,
      eventBus,
    });

    const llmClient = createLlmClientSafe(config, credentials);

    const { allSignals, totalUsage } = await runFileReview({
      files: diff.files,
      llmClient,
      contextText,
      metadata,
      config,
      eventBus,
    });

    const signals = finalizeSignals(allSignals, config, eventBus);

    eventBus.emit(CoreEvents.WorkflowReviewFinished);

    return {
      outcome: "success",
      payload: {
        signals,
        diffSummary,
        ...(totalUsage ? { usage: totalUsage } : {}),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    eventBus.emit(CoreEvents.WorkflowReviewFailed, {
      error: message,
    });

    return {
      outcome: "failure",
      payload: {
        signals: [],
        ...(diffSummary ? { diffSummary } : {}),
      },
    };
  }
}
