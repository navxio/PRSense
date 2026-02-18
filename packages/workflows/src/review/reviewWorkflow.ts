import { CoreEvents, EventBus } from "@prsense/core";
import type { ReviewSignal } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/runtime-config";
import { retrieveContext } from "./retrieveContext.js";
import { buildReviewPrompt } from "@prsense/core";
import { createOpenAiClient, createOllamaClient } from "@prsense/llm";
import type { ReviewWorkflowResult } from "./types.js";

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

    const rawSignals = parsed?.signals;

    if (!Array.isArray(rawSignals)) {
      throw new Error("Invalid review structure");
    }

    const signals: ReviewSignal[] = rawSignals.map(
      (s: any, index: number): ReviewSignal => ({
        id: `signal-${index}`,
        type: s.type,
        severity: s.severity,
        confidence: s.confidence,
        file: s.file,
        lineStart: s.lineStart ?? undefined,
        lineEnd: s.lineEnd ?? undefined,
        message: s.message,
        rationale: s.rationale ?? undefined,
        suggestedFix: s.suggestedFix ?? undefined,
        source: "llm",
      }),
    );

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
