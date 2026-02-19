import { CoreEvents, EventBus } from "@prsense/core";
import type { ReviewSignal } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/runtime-config";
import { retrieveContext } from "./retrieveContext.js";
import { buildReviewPrompt } from "@prsense/core";
import { createOpenAiClient, createOllamaClient } from "@prsense/llm";
import type { ReviewWorkflowResult } from "./types.js";
import { validateReviewOutput } from "./validateReviewOutput.js";
import { dedupeSignals } from "./dedupeSignals.js";
import { normalizeSignal } from "./normalizeSignal.js";

export async function runReviewWorkflow({
  config,
  diffText,
  repoProvider,
  repoName,
  repoRef,
  eventBus,
}: {
  config: ResolvedConfig;
  diffText: string;
  repoProvider: string;
  repoName: string;
  repoRef?: string;
  eventBus: EventBus;
}): Promise<ReviewWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowReviewStarted);

  try {
    // -------------------------------------------------
    // Retrieve context
    // -------------------------------------------------

    const retrieved = await retrieveContext({
      config,
      query: diffText,
      repoProvider,
      repoName,
      ...(repoRef ? { repoRef } : {}),
      limit: config.context.maxChunks,
    });

    const contextText = retrieved.chunks.map((c) => c.content).join("\n\n");

    // -------------------------------------------------
    // Build prompt
    // -------------------------------------------------

    const prompt = buildReviewPrompt({
      diff: diffText,
      context: contextText,
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

    // -------------------------------------------------
    // Parse JSON
    // -------------------------------------------------

    let parsed: any;

    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new Error("LLM returned invalid JSON");
    }
    const validated = validateReviewOutput(parsed);

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
      payload: {
        signals,
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
      },
    };
  }
}
