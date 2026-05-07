// src/review/steps/runReview.ts
import os from "node:os";
import { CoreEvents, DiffFile, ReviewSignal, EventBus } from "@prsense/core";
import type { LlmClient } from "@prsense/llm";

import { runFileReview } from "../lib/runFileReview.js";

import { FileReviewResult, ReviewMetadata } from "../types.js";
import { LlmUsage } from "@prsense/llm";
import { ResolvedConfig } from "@prsense/config";
import { runConcurrent } from "../util.js";

type RunReviewParams = {
  files: DiffFile[];
  llmClient: LlmClient;
  contextText: string;
  metadata?: ReviewMetadata;
  config: ResolvedConfig;
  eventBus: EventBus;
};
export async function runReview({
  files,
  llmClient,
  contextText,
  metadata,
  config,
  eventBus,
}: RunReviewParams) {
  const concurrency = Math.min(4, Math.max(1, os.cpus().length));
  const allSignals: ReviewSignal[] = [];
  let totalUsage: LlmUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  eventBus.emit(CoreEvents.WorkflowReviewConcurrencyConfigured, {
    concurrency,
    files: files.length,
  });

  let results: FileReviewResult[];
  try {
    results = await runConcurrent({
      items: files,
      concurrency,
      worker: (file) =>
        runFileReview({
          file,
          llmClient,
          contextText,
          ...(metadata ? { metadata } : {}),
          config,
          eventBus,
        }),
    });
  } catch (err) {
    eventBus.emit(CoreEvents.WorkflowReviewFailed, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // --- usage & signal accumulation ---

  for (const result of results) {
    if (result.outcome === "failure") continue;
    allSignals.push(...result.signals);

    if (result.usage) {
      totalUsage.promptTokens += result.usage.promptTokens ?? 0;
      totalUsage.completionTokens += result.usage.completionTokens ?? 0;
      totalUsage.totalTokens += result.usage.totalTokens ?? 0;
    }
  }

  return { allSignals, totalUsage };
}
