// packages/workflows/src/review/steps/runReview.ts
import os from "node:os";
import {
  CoreEvents,
  type DiffFile,
  type ReviewSignal,
  type EventBus,
  type ContextChunk,
} from "@prsense/core";
import type { LlmClient, LlmUsage } from "@prsense/llm";
import type { ResolvedConfig } from "@prsense/config";

import { runFileReview } from "../lib/runFileReview.js";
import { formatContextForFile } from "../lib/formatContextForFile.js";
import type { FileReviewResult, ReviewMetadata } from "../types.js";
import { runConcurrent } from "../util.js";

type RunReviewParams = {
  files: DiffFile[];
  llmClient: LlmClient;
  contextByFile: Map<string, ContextChunk[]>;
  metadata?: ReviewMetadata;
  config: ResolvedConfig;
  eventBus: EventBus;
};

export async function runReview({
  files,
  llmClient,
  contextByFile,
  metadata,
  config,
  eventBus,
}: RunReviewParams) {
  const concurrency = Math.min(4, Math.max(1, os.cpus().length));
  const allSignals: ReviewSignal[] = [];
  const totalUsage: LlmUsage = {
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
      worker: (file) => {
        const chunks = contextByFile.get(file.path) ?? [];
        const contextText = formatContextForFile(chunks);

        return runFileReview({
          file,
          llmClient,
          contextText,
          ...(metadata ? { metadata } : {}),
          config,
          eventBus,
        });
      },
    });
  } catch (err) {
    eventBus.emit(CoreEvents.WorkflowReviewFailed, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // --- usage & signal accumulation ---

  let failedFiles = 0;
  for (const result of results) {
    if (result.outcome === "failure") {
      failedFiles++;
      continue;
    }
    allSignals.push(...result.signals);

    if (result.usage) {
      totalUsage.promptTokens += result.usage.promptTokens ?? 0;
      totalUsage.completionTokens += result.usage.completionTokens ?? 0;
      totalUsage.totalTokens += result.usage.totalTokens ?? 0;
    }
  }

  return { allSignals, totalUsage, failedFiles };
}
