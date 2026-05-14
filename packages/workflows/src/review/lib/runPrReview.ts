import { CoreEvents, EventBus, ReviewSignal } from "@prsense/core";
import type { LlmClient, LlmUsage } from "@prsense/llm";

import { buildReviewPrompt, UnifiedDiff } from "@prsense/core";

import { ReviewMetadata } from "../types.js";

type RunPrReviewParams = {
  diff: UnifiedDiff;
  llmClient: LlmClient;
  contextText: string;
  metadata?: ReviewMetadata;
  eventBus: EventBus;
};

export async function runPrReview({
  diff,
  llmClient,
  contextText,
  metadata,
  eventBus,
}: RunPrReviewParams): Promise<{
  signals: ReviewSignal[];
  usage?: LlmUsage;
}> {
  const prompt = buildReviewPrompt({
    diff,
    context: contextText,
    metadata,
  });

  eventBus.emit(CoreEvents.ReviewStarted, {
    files: diff.files.length,
  });

  const response = await llmClient.generateStructured<{
    signals: ReviewSignal[];
  }>({
    system: prompt.system,
    user: prompt.user,
  });

  eventBus.emit(CoreEvents.ReviewCompleted, {
    signals: response.object.signals.length,
  });

  return {
    signals: response.object.signals,
    usage: response.usage,
  };
}
