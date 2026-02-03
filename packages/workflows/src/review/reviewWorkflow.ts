// packages/workflows/src/review/reviewWorkflow.ts

import { CoreEvents, EventBus, UnifiedDiff } from "@prsense/core";
import type { ContextRetriever, ReviewSignalCompiler } from "./ports.js";
import type { ReviewWorkflowResult } from "./types.js";

export async function runReviewWorkflow({
  diff,
  retriever,
  compiler,
  eventBus,
}: {
  diff: UnifiedDiff;
  retriever: ContextRetriever;
  compiler: ReviewSignalCompiler;
  eventBus: EventBus;
}): Promise<ReviewWorkflowResult> {
  eventBus.emit(CoreEvents.RunStarted);
  eventBus.emit(CoreEvents.WorkflowReviewStarted);

  try {
    eventBus.emit(CoreEvents.ContextDiffLoaded);

    const retrieved = await retriever.retrieve(diff);

    eventBus.emit(CoreEvents.ContextChunksBuilt, {
      total: retrieved.stats.totalChunks,
      truncated: retrieved.stats.truncated,
    });

    if (retrieved.stats.truncated) {
      eventBus.emit(CoreEvents.ContextTruncated);
    }

    const signals = await compiler.compile(diff, retrieved.chunks);

    eventBus.emit(CoreEvents.SignalCompiled, {
      count: signals.length,
    });

    eventBus.emit(CoreEvents.WorkflowReviewFinished);
    eventBus.emit(CoreEvents.RunFinished);

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
    eventBus.emit(CoreEvents.RunFailed, {
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
