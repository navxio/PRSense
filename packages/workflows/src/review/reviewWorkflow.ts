// packages/workflows/src/review/reviewWorkflow.ts
import {
  CoreEvents,
  type EventBus,
  type DiffProvider,
  type ContextProvider,
} from "@prsense/core";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import type { ReviewWorkflowResult } from "./types.js";
import { loadDiff } from "./steps/loadDiff.js";
import { resolveContext } from "./steps/resolveContext.js";
import { createLlmClientSafe } from "./steps/createLlmClient.js";
import { runReview } from "./steps/runReview.js";
import { finalizeSignals } from "./steps/finaliseSignals.js";
import type {
  IndexMetadataRepository,
  RagChunkRepository,
} from "@prsense/context";
import type { LlmClient } from "@prsense/llm";

export async function runReviewWorkflow({
  repository,
  metadataRepository,
  config,
  credentials,
  diffProvider,
  eventBus,
  llmClient: injectedLlmClient,
  contextProviders,
}: {
  repository: RagChunkRepository;
  metadataRepository: IndexMetadataRepository;
  config: ResolvedConfig;
  credentials: CredentialContext;
  diffProvider: DiffProvider;
  eventBus: EventBus;
  llmClient?: LlmClient;
  contextProviders?: ContextProvider[];
}): Promise<ReviewWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowReviewStarted);
  let diffSummary: { files: string[] } | undefined;

  try {
    const {
      diff,
      revision,
      baseRevision,
      repositoryIdentity,
      metadata,
      diffSummary,
    } = await loadDiff(diffProvider);

    eventBus.emit(CoreEvents.WorkflowReviewDiffLoaded, {
      files: diff.files.length,
      summary: diffSummary,
    });

    if (diff.files.length === 0) {
      return {
        outcome: "success",
        payload: { signals: [], diffSummary },
      };
    }

    const { contextByFile } = await resolveContext({
      config,
      repositoryIdentity,
      revision,
      baseRevision,
      diff,
      eventBus,
      repository,
      metadataRepository,
      ...(metadata ? { metadata } : {}),
      ...(contextProviders ? { providers: contextProviders } : {}),
    });

    const llmClient =
      injectedLlmClient ?? createLlmClientSafe(config, credentials);

    const { allSignals, totalUsage, failedFiles } = await runReview({
      files: diff.files,
      llmClient,
      contextByFile,
      ...(metadata ? { metadata } : {}),
      config,
      eventBus,
    });

    if (failedFiles === diff.files.length) {
      throw new Error(`All ${failedFiles} file reviews failed`);
    }

    const { signals, totalBeforeCap } = finalizeSignals(
      allSignals,
      config,
      eventBus,
    );

    eventBus.emit(CoreEvents.WorkflowReviewFinished);

    return {
      outcome: "success",
      payload: {
        signals,
        diffSummary,
        ...(totalUsage ? { usage: totalUsage } : {}),
        totalBeforeCap,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    eventBus.emit(CoreEvents.WorkflowReviewFailed, { error: message });
    return {
      outcome: "failure",
      payload: {
        signals: [],
        ...(diffSummary ? { diffSummary } : {}),
      },
    };
  }
}
