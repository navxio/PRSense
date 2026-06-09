// packages/workflows/src/review/reviewWorkflow.ts

import { CoreEvents, EventBus } from "@prsense/core";
import type { DiffProvider } from "@prsense/core";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import type { ReviewWorkflowResult } from "../types.js";
import { loadDiff } from "../steps/loadDiff.js";
import { resolveContext } from "../steps/resolveContext.js";
import { createLlmClientSafe } from "../steps/createLlmClient.js";
import { runReview } from "../steps/runReview.js";
import { finalizeSignals } from "../steps/finaliseSignals.js";
import { IndexMetadataRepository, RagChunkRepository } from "@prsense/context";

export async function runReviewWorkflow({
  repository,
  metadataRepository,
  config,
  credentials,
  diffProvider,
  eventBus,
}: {
  repository: RagChunkRepository;
  metadataRepository: IndexMetadataRepository;
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

    eventBus.emit(CoreEvents.WorkflowReviewDiffLoaded, {
      files: diff.files.length,
      summary,
    });

    diffSummary = summary;

    if (diff.files.length === 0) {
      return {
        outcome: "success",
        payload: { signals: [], diffSummary },
      };
    }

    const { contextText } = await resolveContext({
      repository,
      metadataRepository,
      config,
      repositoryIdentity,
      revision,
      metadata,
      diff,
      eventBus,
    });

    const llmClient = createLlmClientSafe(config, credentials);

    const { allSignals, totalUsage } = await runReview({
      files: diff.files,
      llmClient,
      contextText,
      ...(metadata ? { metadata } : {}),
      config,
      eventBus,
    });

    const count = allSignals.length;

    const signals = finalizeSignals(allSignals, config, eventBus);

    eventBus.emit(CoreEvents.WorkflowReviewFinished);

    return {
      outcome: "success",
      payload: {
        signals,
        diffSummary,
        ...(totalUsage ? { usage: totalUsage } : {}),
        totalSignalCount: count,
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
