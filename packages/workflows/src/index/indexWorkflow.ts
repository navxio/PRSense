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
  buildChunks,
  resolveExecutionPlan,
} from "./util.js";

export async function runIndexWorkflow({
  config,
  credentials,
  target,
  force,
  dryRun,
  eventBus,
  version,
  ref,
}: {
  config: ResolvedConfig;
  credentials: CredentialContext;
  target: string;
  force?: boolean;
  dryRun?: boolean;
  eventBus: EventBus;
  version: string;
  ref?: string;
}): Promise<IndexWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowIndexStarted);

  try {
    // -------------------------------------------------
    // Resolve Repository Source
    // -------------------------------------------------

    let repositorySource = resolveRepositorySource(target, ref);

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

    const incompatibilityReasons: string[] = [];

    if (stored) {
      if (!stored.chunking || stored.chunking.version !== 2) {
        incompatibilityReasons.push(
          `chunking version changed (${stored.chunking?.version ?? "unknown"} → 2)`,
        );
      }

      if (
        stored.embedding.provider !== config.embeddings.provider ||
        stored.embedding.model !== config.embeddings.model
      ) {
        incompatibilityReasons.push(
          `embedding changed (${stored.embedding.provider}/${stored.embedding.model} → ${config.embeddings.provider}/${config.embeddings.model})`,
        );
      }
    }

    let plan = planIndex({
      stored,
      currentFingerprint,
      force: force || false,
    });
    if (incompatibilityReasons.length > 0 && !force) {
      eventBus.emit(CoreEvents.WorkflowIndexRebuildRequired, {
        reason: [
          "Index is incompatible with current configuration.",
          "",
          "Reasons:",
          ...incompatibilityReasons.map((r: string) => `- ${r}`),
          "",
          "Run with --force to rebuild:",
          "  prsense index . --force",
        ].join("\n"),
      });

      return {
        outcome: "failure",
        payload: {
          chunksIndexed: 0,
        },
      };
    }
    if (incompatibilityReasons.length > 0) {
      if (force) {
        eventBus.emit(CoreEvents.WorkflowIndexRebuildRequired, {
          reason: [
            "Rebuilding index due to incompatible configuration.",
            ...incompatibilityReasons.map((r: string) => `- ${r}`),
          ].join("\n"),
          forced: true,
        });

        plan = { type: "full" };
      }
    }

    const repoPath = repositorySource.getLocalPath();
    if (!repoPath) {
      throw new Error("Repository must be git-backed");
    }

    if (plan.type === "incremental" && revision.commitSha !== plan.targetSha) {
      throw new Error(
        `Repository not at expected revision. Expected ${plan.targetSha}, got ${revision.commitSha}`,
      );
    }
    let executionPlan = resolveExecutionPlan({
      plan,
      repoPath,
    });

    // fill full plan files lazily
    if (executionPlan.kind === "full") {
      executionPlan = {
        kind: "full",
        files: await repositorySource.listFiles(),
      };
    }

    eventBus.emit(CoreEvents.WorkflowIndexPlanComputed, {
      type: executionPlan.kind,
    });

    switch (executionPlan.kind) {
      case "noop": {
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

      case "delete-only": {
        eventBus.emit(CoreEvents.WorkflowIndexFilesChanged, {
          changedFiles: [],
        });

        eventBus.emit(CoreEvents.WorkflowIndexFilesDeleted, {
          deletedFiles: executionPlan.deletedFiles,
        });
        if (dryRun) {
          eventBus.emit(CoreEvents.WorkflowIndexFinished);

          return {
            outcome: "success",
            payload: {
              chunksIndexed: 0,
              commitSha: revision.commitSha,
              upToDate: false,
              summary: {
                filesChanged: 0,
                filesDeleted: executionPlan.deletedFiles.length,
                deleteAll: false,
              },
            },
          };
        }

        if (!dryRun && executionPlan.pathsToDelete.length > 0) {
          await chunkRepository.deleteByPaths(
            identity.provider,
            identity.id,
            executionPlan.pathsToDelete,
          );
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

      case "full":
      case "incremental": {
        const changedFiles =
          executionPlan.kind === "full"
            ? executionPlan.files
            : executionPlan.changedFiles;

        const deletedFiles =
          executionPlan.kind === "full" ? [] : executionPlan.deletedFiles;

        const pathsToDelete =
          executionPlan.kind === "full" ? [] : executionPlan.pathsToDelete;

        eventBus.emit(CoreEvents.WorkflowIndexFilesChanged, {
          changedFiles,
        });

        eventBus.emit(CoreEvents.WorkflowIndexFilesDeleted, {
          deletedFiles,
        });
        if (executionPlan.kind === "full" && changedFiles.length === 0) {
          if (!dryRun) {
            await chunkRepository.deleteByRepository(
              identity.provider,
              identity.id,
            );
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
                deleteAll: executionPlan.kind === "full",
              },
            },
          };
        }

        if (executionPlan.kind === "full") {
          if (!dryRun) {
            await chunkRepository.deleteByRepository(
              identity.provider,
              identity.id,
            );
          }
        }

        if (pathsToDelete.length > 0) {
          await chunkRepository.deleteByPaths(
            identity.provider,
            identity.id,
            pathsToDelete,
          );
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
      }
    }
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
