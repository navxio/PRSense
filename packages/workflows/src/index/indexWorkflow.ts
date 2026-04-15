// packages/workflows/src/index/indexWorkflow.ts
import { CoreEvents, EventBus, ContextChunk } from "@prsense/core";
import {
  PostgresIndexMetadataRepository,
  PostgresRagChunkRepository,
  createCharChunker,
} from "@prsense/context";
import type { IndexWorkflowResult } from "./types.js";
import type { ResolvedConfig, CredentialContext } from "@prsense/config";
import {
  createOpenAiEmbeddingClient,
  createOllamaEmbeddingClient,
} from "@prsense/llm";
import {
  resolveRepositorySource,
  planIndex,
  computeDiff,
  buildChunks,
} from "./util.js";

export async function runIndexWorkflow({
  config,
  credentials,
  target,
  force,
  dryRun,
  eventBus,
  version,
}: {
  config: ResolvedConfig;
  credentials: CredentialContext;
  target: string;
  force?: boolean;
  dryRun?: boolean;
  eventBus: EventBus;
  version: string;
}): Promise<IndexWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowIndexStarted);

  try {
    // -------------------------------------------------
    // Resolve Repository Source
    // -------------------------------------------------

    let repositorySource = resolveRepositorySource(target);

    // -------------------------------------------------
    // Resolve Identity + Revision
    // -------------------------------------------------

    const identity = repositorySource.getRepositoryIdentity();

    eventBus.emit(CoreEvents.WorkflowIndexRepositorySourceResolved, {
      provider: identity.provider,
      id: identity.id,
    });

    let revision;

    try {
      revision = await repositorySource.getRevision();
    } catch {
      throw new Error(
        "Indexing requires a git repository. Run inside a git repository.",
      );
    }

    // -------------------------------------------------
    // Metadata Repository
    // -------------------------------------------------

    const metadataRepository = new PostgresIndexMetadataRepository(
      config.database.url,
    );

    const chunkRepository = new PostgresRagChunkRepository(config.database.url);

    const stored = await metadataRepository.load(
      identity.provider,
      identity.id,
    );

    // -------------------------------------------------
    // Create Embedding Client
    // -------------------------------------------------

    let embeddingClient;

    if (config.embeddings.provider === "openai") {
      const apiKey = credentials.openai?.apiKey;
      if (!apiKey) {
        throw new Error("OpenAI embedding credentials missing");
      }

      embeddingClient = createOpenAiEmbeddingClient({
        apiKey,
        model: config.embeddings.model,
      });
    } else {
      embeddingClient = createOllamaEmbeddingClient({
        model: config.embeddings.model,
      });
    }

    const embeddingDimension = await embeddingClient.dimension();
    eventBus.emit(CoreEvents.WorkflowIndexEmbeddingDimensionDetected, {
      dimension: embeddingDimension,
    });

    const dbDimension = await chunkRepository.getEmbeddingColumnDimension();

    if (dbDimension !== null && dbDimension !== embeddingDimension) {
      eventBus.emit(CoreEvents.WorkflowIndexDimensionMismatch, {
        dbDimension,
        embeddingDimension,
      });

      throw new Error(
        `Embedding dimension mismatch: database=${dbDimension}, model=${embeddingDimension}. Recreate table or change model.`,
      );
    }

    // -------------------------------------------------
    // Compute Current Fingerprint
    // -------------------------------------------------

    const currentFingerprint = {
      commitSha: revision.commitSha,
      embeddingProvider: config.embeddings.provider,
      embeddingModel: config.embeddings.model,
      embeddingDimension,
      chunkStrategy: "default",
      chunkVersion: 2,
    };

    let incompatible = false;

    if (stored) {
      if (!stored.chunking || stored.chunking.version !== 2) {
        incompatible = true;
      }
    }

    let plan = planIndex({
      stored,
      currentFingerprint,
      force: force || false,
    });
    if (incompatible) {
      eventBus.emit(CoreEvents.WorkflowIndexRebuildRequired, {
        reason: "incompatible-index",
      });
      plan = { type: "full" };
    }

    eventBus.emit(CoreEvents.WorkflowIndexPlanComputed, {
      type: plan.type,
    });

    // -------------------------------------------------
    // Up-to-date Case
    // -------------------------------------------------

    let deleteAll = false;
    let pathsToDelete: string[] = []
    if (plan.type === "noop") {
      eventBus.emit(CoreEvents.WorkflowIndexUpToDate, {
        commitSha: revision.commitSha,
      });

      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: 0,
          commitSha: revision.commitSha,
          upToDate: true,
        },
      };
    }

    let changedFiles: string[] = [];
    let deletedFiles: string[] = [];

    if (plan.type === "full") {
      changedFiles = await repositorySource.listFiles();
      deleteAll = true;
    } else {
      await repositorySource.listFiles();
    }
    const repoPath = repositorySource.getLocalPath();

    if (plan.type === "incremental") {
      const diff = computeDiff({
        repoPath,
        baseSha: plan.baseSha,
        targetSha: plan.targetSha,
      });
      changedFiles = diff.changed;
      deletedFiles = diff.deleted;

      pathsToDelete = [...changedFiles, ...deletedFiles]
    }

    eventBus.emit(CoreEvents.WorkflowIndexFilesChanged, {
      changedFiles,
    });
    eventBus.emit(CoreEvents.WorkflowIndexFilesDeleted, {
      deletedFiles,
    });



    const chunker = createCharChunker({
      maxChars: config.index.chunkSizeChars,
      overlapChars: config.index.chunkOverlapChars,
    });

    const chunks: ContextChunk[] = await buildChunks({
      files: changedFiles,
      repositorySource,
      chunker,
      eventBus,
    });

    eventBus.emit(CoreEvents.ContextChunksBuilt, {
      count: chunks.length,
    });
    if (dryRun) {
      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: chunks.length,
          commitSha: revision.commitSha,
          upToDate: false,
          summary: {
            filesChanged: changedFiles.length,
            filesDeleted: deletedFiles.length,
            deleteAll
          }
        },
      };
    }

    if (deleteAll) {
      await chunkRepository.deleteByRepository(identity.provider, identity.id);
    }

    if (pathsToDelete.length > 0) {
      await chunkRepository.deleteByPaths(
        identity.provider,
        identity.id,
        pathsToDelete,
      );
    }

    if (changedFiles.length === 0 && deletedFiles.length > 0) {
      await metadataRepository.save({
        repository: {
          provider: identity.provider,
          id: identity.id,
          ...(revision.defaultBranch
            ? { defaultBranch: revision.defaultBranch }
            : {}),
        },
        revision: {
          commitSha: revision.commitSha,
        },
        embedding: {
          provider: config.embeddings.provider,
          model: config.embeddings.model,
          dimension: embeddingDimension,
        },
        chunking: {
          strategy: "default",
          version: 2,
        },
        prsenseVersion: version,
        createdAt: new Date().toISOString(),
      });

      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: 0,
          commitSha: revision.commitSha,
          upToDate: false,
        },
      };
    }

    if (plan.type === "full" && changedFiles.length === 0) {
      if (!dryRun) {
        await chunkRepository.deleteByRepository(identity.provider, identity.id);
      }

      await metadataRepository.save({
        repository: {
          provider: identity.provider,
          id: identity.id,
          ...(revision.defaultBranch
            ? { defaultBranch: revision.defaultBranch }
            : {}),
        },
        revision: {
          commitSha: revision.commitSha,
        },
        embedding: {
          provider: config.embeddings.provider,
          model: config.embeddings.model,
          dimension: embeddingDimension,
        },
        chunking: {
          strategy: "default",
          version: 2,
        },
        prsenseVersion: version,
        createdAt: new Date().toISOString(),
      });

      eventBus.emit(CoreEvents.WorkflowIndexFinished);

      return {
        outcome: "success",
        payload: {
          chunksIndexed: 0,
          commitSha: revision.commitSha,
          upToDate: false,
        },
      };
    }
    // -------------------------------------------------
    // Embed + Persist Chunks
    // -------------------------------------------------

    //PERF: different batch size for openai based embedding
    const BATCH_SIZE = 32;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      eventBus.emit(CoreEvents.WorkflowIndexProgress, {
        processed: Math.min(i + BATCH_SIZE, chunks.length),
        total: chunks.length,
      });

      const embeddings = await embeddingClient.embed(
        batch.map((c) => c.content),
      );

      const rows = batch.map((chunk, idx) => {
        const embedding = embeddings[idx];

        if (!embedding) {
          throw new Error("Embedding generation mismatch");
        }
        return {
          chunk,
          repoProvider: identity.provider,
          repoName: identity.id,
          repoRef: revision.commitSha,
          embedding,
        };
      });

      await chunkRepository.insertChunks(rows);
    }

    await metadataRepository.save({
      repository: {
        provider: identity.provider,
        id: identity.id,
        ...(revision.defaultBranch
          ? { defaultBranch: revision.defaultBranch }
          : {}),
      },
      revision: {
        commitSha: revision.commitSha,
      },
      embedding: {
        provider: config.embeddings.provider,
        model: config.embeddings.model,
        dimension: embeddingDimension,
      },
      chunking: {
        strategy: "default",
        version: 2,
      },
      prsenseVersion: version,
      createdAt: new Date().toISOString(),
    });

    eventBus.emit(CoreEvents.WorkflowIndexFinished);

    return {
      outcome: "success",
      payload: {
        chunksIndexed: chunks.length,
        commitSha: revision.commitSha,
        upToDate: false,
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
