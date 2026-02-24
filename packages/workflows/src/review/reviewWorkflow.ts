// packages/workflows/src/review/reviewWorkflow.ts

import { CoreEvents, EventBus } from "@prsense/core";
import type { ReviewSignal, DiffProvider } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/runtime-config";
import { retrieveContext } from "./retrieveContext.js";
import { PostgresIndexMetadataRepository } from "packages/context/dist/index.js";
import { buildReviewPrompt } from "@prsense/core";
import { createOpenAiClient, createOllamaClient } from "@prsense/llm";
import type { ReviewWorkflowResult } from "./types.js";
import { validateReviewOutput } from "./validateReviewOutput.js";
import { buildDiffEmbeddingQuery } from "./buildDiffEmbeddingQuery.js";
import { dedupeSignals } from "./dedupeSignals.js";
import { normalizeSignal } from "./normalizeSignal.js";

export async function runReviewWorkflow({
  config,
  diffProvider,
  eventBus,
}: {
  config: ResolvedConfig;
  diffProvider: DiffProvider;
  eventBus: EventBus;
}): Promise<ReviewWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowReviewStarted);

  try {
    // -------------------------------------------------
    // Load diff from provider
    // -------------------------------------------------

    const { diff, revision, repositoryIdentity, metadata } =
      await diffProvider.load();

    const metadataRepository = new PostgresIndexMetadataRepository(
      config.database.url,
    );

    const storedMetadata = await metadataRepository.load(
      repositoryIdentity.provider,
      repositoryIdentity.id,
    );

    let contextualReviewAvailable = false;

    if (storedMetadata) {
      const embeddingMatches =
        storedMetadata.embedding.provider === config.embeddings.provider &&
        storedMetadata.embedding.model === config.embeddings.model;

      const revisionMatches = storedMetadata.revision.commitSha === revision;

      if (embeddingMatches && revisionMatches) {
        contextualReviewAvailable = true;
      }
    }

    if (!storedMetadata) {
      eventBus.emit(CoreEvents.WorkflowReviewContextUnavailable);
    } else if (!contextualReviewAvailable) {
      eventBus.emit(CoreEvents.WorkflowReviewIndexOutdated, {
        indexedCommit: storedMetadata.revision.commitSha,
        currentCommit: revision,
      });
    } else {
      eventBus.emit(CoreEvents.WorkflowReviewContextAvailable);
    }

    if (diff.files.length === 0) {
      eventBus.emit(CoreEvents.WorkflowReviewFinished);
      return {
        outcome: "success",
        payload: { signals: [] },
      };
    }

    // -------------------------------------------------
    // Retrieve contextual chunks (RAG) if available
    // -------------------------------------------------

    let contextText = "";

    if (contextualReviewAvailable) {
      const retrievalQuery = buildDiffEmbeddingQuery({
        diff,
        ...(metadata?.title ? { title: metadata.title } : {}),
        ...(metadata?.description ? { description: metadata.description } : {}),
      });

      const retrieved = await retrieveContext({
        config,
        query: retrievalQuery,
        repoProvider: repositoryIdentity.provider,
        repoName: repositoryIdentity.id,
        ...(revision ? { repoRef: revision } : {}),
        limit: config.context.maxChunks,
      });

      contextText = retrieved.chunks.map((c) => c.content).join("\n\n");
    }

    // -------------------------------------------------
    // Build LLM prompt
    // -------------------------------------------------

    const prompt = buildReviewPrompt({
      diff,
      context: contextText,
      ...(metadata ? metadata : null),
    });

    // -------------------------------------------------
    // Create LLM client
    // -------------------------------------------------

    const llmClient =
      config.llm.provider === "openai"
        ? createOpenAiClient({
            apiKey: process.env.OPENAI_API_KEY!,
            model: config.llm.model,
          })
        : createOllamaClient({
            model: config.llm.model,
          });

    // -------------------------------------------------
    // Generate review
    // -------------------------------------------------

    const response = await llmClient.generate({ prompt });

    let parsed: any;

    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new Error("LLM returned invalid JSON");
    }

    const validated = validateReviewOutput(parsed);

    // -------------------------------------------------
    // Normalize + filter signals
    // -------------------------------------------------

    const rawSignals = validated.signals;

    const normalized = rawSignals
      .map(normalizeSignal)
      .filter((s): s is ReviewSignal => Boolean(s));

    const thresholded = normalized.filter(
      (s) => s.confidence >= config.review.confidenceThreshold,
    );

    const signals = dedupeSignals(thresholded);

    eventBus.emit(CoreEvents.SignalCompiled, {
      count: signals.length,
    });

    eventBus.emit(CoreEvents.WorkflowReviewFinished);

    return {
      outcome: "success",
      payload: { signals },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    eventBus.emit(CoreEvents.WorkflowReviewFailed, {
      error: message,
    });

    return {
      outcome: "failure",
      payload: { signals: [] },
    };
  }
}
