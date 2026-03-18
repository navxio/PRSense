// steps/runFileReview.ts
import {
  type ReviewSignal,
  buildReviewPrompt,
  CoreEvents,
} from "@prsense/core";
import type { LlmUsage } from "@prsense/llm";

import { validateReviewOutput } from "../validateReviewOutput.js";

import { extractJson } from "../extractJson.js";
export async function runFileReview({
  files,
  llmClient,
  contextText,
  metadata,
  config,
  eventBus,
}: any) {
  const allSignals: ReviewSignal[] = [];
  let totalUsage: LlmUsage | undefined;

  for (const file of files) {
    if (!file.patch || file.patch.length < 40) continue;

    try {
      eventBus.emit(CoreEvents.WorkflowReviewFileStarted, {
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

      eventBus.emit(CoreEvents.WorkflowReviewLlmRequestStarted);

      const start = Date.now();

      const response = await llmClient.generate({ prompt });

      const durationMs = Date.now() - start;

      eventBus.emit(CoreEvents.WorkflowReviewLlmResponseReceived, {
        outputChars: response.text.length,
        usage: response.usage,
        durationMs,
      });

      // --- usage accumulation ---
      if (response.usage) {
        if (!totalUsage) totalUsage = { ...response.usage };
        else {
          totalUsage.promptTokens += response.usage.promptTokens;
          totalUsage.completionTokens += response.usage.completionTokens;
          totalUsage.totalTokens += response.usage.totalTokens;
        }
      }

      // --- parse ---
      let parsed;
      const cleaned = extractJson(response.text);

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        eventBus.emit(CoreEvents.WorkflowReviewInvalidJson, {
          file: file.path,
          rawResponsePreview: response.text.slice(0, 2000),
        });
        throw new Error("Invalid JSON");
      }

      // --- validate + retry ---
      let validated;

      try {
        validated = validateReviewOutput(parsed);
      } catch {
        eventBus.emit(CoreEvents.WorkflowReviewInvalidJson, {
          file: file.path,
          rawResponsePreview: cleaned.slice(0, 2000),
        });

        const retry = await llmClient.generate({
          prompt: {
            system: "Fix JSON schema.",
            user: cleaned,
          },
        });

        eventBus.emit(CoreEvents.WorkflowReviewLlmRetry, {
          file: file.path,
          reason: "schema_validation_failed",
        });

        const retryParsed = JSON.parse(extractJson(retry.text));
        validated = validateReviewOutput(retryParsed);
      }

      allSignals.push(...validated.signals);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      eventBus.emit(CoreEvents.WorkflowReviewFileFailed, {
        file: file.path,
        error: message,
      });

      // IMPORTANT: continue instead of throwing
      continue;
    }
  }

  return { allSignals, totalUsage };
}
