// packages/workflows/src/index/runIndexWorkflow.ts

import { CoreEvents, EventBus } from "@prsense/core";
import type { ContextIndexer } from "./ports.js";
import type { IndexWorkflowResult } from "./types.js";

export async function runIndexWorkflow({
  indexer,
  eventBus,
}: {
  indexer: ContextIndexer;
  eventBus: EventBus;
}): Promise<IndexWorkflowResult> {
  eventBus.emit(CoreEvents.RunStarted);
  eventBus.emit("workflow.index.started");

  try {
    const chunks = await indexer.buildChunks();

    eventBus.emit(CoreEvents.ContextChunksBuilt, {
      count: chunks.length,
    });

    await indexer.persistChunks(chunks);

    eventBus.emit("workflow.index.finished", {
      chunks: chunks.length,
    });

    eventBus.emit(CoreEvents.RunFinished);

    return {
      outcome: "success",
      payload: {
        chunksIndexed: chunks.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    eventBus.emit("workflow.index.failed", { error: message });
    eventBus.emit(CoreEvents.RunFailed, { error: message });

    return {
      outcome: "failure",
      payload: {
        chunksIndexed: 0,
      },
    };
  }
}
