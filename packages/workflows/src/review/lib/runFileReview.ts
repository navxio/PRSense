// src/review/lib/runFileReview.ts
// run single file review
import { CoreEvents, DiffFile, type EventBus } from "@prsense/core";
import { ResolvedConfig } from "@prsense/config";
import { buildReviewPrompt } from "@prsense/core";
import { extractJson } from "./extractJson.js";
import type { FileReviewResult, ReviewMetadata } from "../types.js";
import { validateReviewOutput } from "./validateReviewOutput.js";
import { LlmClient } from "@prsense/llm";

export async function runFileReview({
  file,
  llmClient,
  contextText,
  metadata,
  config,
  eventBus,
}: {
  file: DiffFile;
  llmClient: LlmClient;
  contextText: string;
  metadata?: ReviewMetadata;
  config: ResolvedConfig;
  eventBus: EventBus;
}): Promise<FileReviewResult> {
  // run the review
  try {
    eventBus.emit(CoreEvents.WorkflowReviewFileReviewStarted, {
      file: file.path,
    });

    const prompt = buildReviewPrompt({
      diff: { files: [file] },
      context: contextText,
      ...(metadata ?? {}),
    });

    eventBus.emit(CoreEvents.WorkflowReviewPromptBuilt, {
      model: config.llm.model,
      provider: config.llm.provider,
      promptChars: JSON.stringify(prompt).length,
    });

    eventBus.emit(CoreEvents.WorkflowReviewLlmRequestStarted, {
      file: file.path,
    });

    const start = Date.now();

    const response = await llmClient.generate({ prompt });

    const durationMs = Date.now() - start;

    eventBus.emit(CoreEvents.WorkflowReviewLlmResponseReceived, {
      file: file.path,
      outputChars: response.text.length,
      usage: response.usage,
      durationMs,
    });

    const cleaned = extractJson(response.text);
    const parsed = JSON.parse(cleaned);
    const validated = validateReviewOutput(parsed);

    eventBus.emit(CoreEvents.WorkflowReviewFileReviewFinished, {
      file: file.path,
      signals: validated.signals.length,
      usage: response.usage,
    });

    if (response.usage) {
      return {
        outcome: "success",
        file: file.path,
        signals: validated.signals ?? [],
        usage: response.usage,
      };
    }
    return {
      outcome: "success",
      file: file.path,
      signals: validated.signals ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    eventBus.emit(CoreEvents.WorkflowReviewFileReviewFailed, {
      file: file.path,
      error: message,
    });

    return {
      outcome: "failure",
      file: file.path,
      error: message,
    };
  }
}
