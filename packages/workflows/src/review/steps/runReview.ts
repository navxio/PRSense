// src/review/steps/runReview.ts
import pLimit from "p-limit";
import os from "node:os";
import {
  CoreEvents,
  IndexMetadata,
  DiffFile,
  ReviewSignal,
  EventBus,
} from "@prsense/core";
import type { LlmClient } from "@prsense/llm";

import { runFileReview } from "../lib/runFileReview.js";

import { FileReviewResult } from "../types.js";
import { LlmUsage } from "@prsense/llm";
import { ResolvedConfig } from "@prsense/config";

type RunReviewParams = {
  files: DiffFile[];
  llmClient: LlmClient;
  contextText: string;
  metadata: IndexMetadata;
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

  const limit = pLimit(concurrency);
  const input = files.map((file: DiffFile) =>
    limit(() =>
      runFileReview({
        file,
        llmClient,
        contextText,
        metadata,
        config,
        eventBus,
      }),
    ),
  );
  let results: FileReviewResult[];
  try {
    results = await Promise.all(input);
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
