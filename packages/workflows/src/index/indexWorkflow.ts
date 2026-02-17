// packages/workflows/src/index/runIndexWorkflow.ts

import { CoreEvents, EventBus } from "@prsense/core";
import { RepositorySource } from "@prsense/context";
import { IndexMetadataRepository } from "@prsense/context";
import type { IndexWorkflowResult } from "./types.js";
import type { ResolvedConfig } from "@prsense/runtime-config";

export async function runIndexWorkflow({
  config,
  repositorySource,
  metadataRepository,
  force,
  dryRun,
  eventBus,
}: {
  config: ResolvedConfig;
  repositorySource: RepositorySource;
  metadataRepository: IndexMetadataRepository;
  force?: boolean;
  dryRun?: boolean;
  eventBus: EventBus;
}): Promise<IndexWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowIndexStarted);

  try {
    const identity = repositorySource.getRepositoryIdentity();
    const revision = await repositorySource.getRevision();

    const stored = await metadataRepository.load(
      identity.provider,
      identity.id,
    );

    const currentFingerprint = {
      commitSha: revision.commitSha,
      embeddingProvider: config.embeddings.provider,
      embeddingModel: config.embeddings.model,
      chunkStrategy: "default",
      chunkVersion: 1,
    };

    let rebuildRequired = false;

    if (!stored) {
      rebuildRequired = true;
    } else {
      if (stored.revision.commitSha !== currentFingerprint.commitSha) {
        rebuildRequired = true;
      }

      if (stored.embedding.provider !== currentFingerprint.embeddingProvider) {
        rebuildRequired = true;
      }

      if (stored.embedding.model !== currentFingerprint.embeddingModel) {
        rebuildRequired = true;
      }

      if (stored.chunking.strategy !== currentFingerprint.chunkStrategy) {
        rebuildRequired = true;
      }

      if (stored.chunking.version !== currentFingerprint.chunkVersion) {
        rebuildRequired = true;
      }
    }

    if (!rebuildRequired) {
      eventBus.emit(CoreEvents.WorkflowIndexUpToDate, {
        commitSha: revision.commitSha,
      });

      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: 0,
        },
      };
    }

    eventBus.emit(CoreEvents.WorkflowIndexOutdated, {
      commitSha: revision.commitSha,
    });

    if (dryRun) {
      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: 0,
        },
      };
    }

    if (!force && stored) {
      eventBus.emit(CoreEvents.WorkflowIndexRebuildRequired, {
        reason: "index-outdated",
      });

      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: 0,
        },
      };
    }

    // --- Rebuild begins ---

    const files = await repositorySource.listFiles();

    const chunks = [];

    for (const file of files) {
      const content = await repositorySource.readFile(file);

      chunks.push({
        id: file,
        source: { kind: "code", path: file },
        content,
      });
    }

    eventBus.emit(CoreEvents.ContextChunksBuilt, {
      count: chunks.length,
    });

    // TODO: persist chunks via existing context index logic
    // For now, assume persistence already exists elsewhere.

    await metadataRepository.save({
      repository: {
        provider: identity.provider,
        id: identity.id,
        defaultBranch: revision.defaultBranch,
      },
      revision: {
        commitSha: revision.commitSha,
      },
      embedding: {
        provider: config.embeddings.provider,
        model: config.embeddings.model,
      },
      chunking: {
        strategy: "default",
        version: 1,
      },
      prsenseVersion: "0.1.0",
      createdAt: new Date().toISOString(),
    });

    eventBus.emit(CoreEvents.WorkflowIndexFinished);

    return {
      outcome: "success",
      payload: {
        chunksIndexed: chunks.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    eventBus.emit(CoreEvents.WorkflowIndexFailed, {
      error: message,
    });

    return {
      outcome: "failure",
      payload: {
        chunksIndexed: 0,
      },
    };
  }
}
