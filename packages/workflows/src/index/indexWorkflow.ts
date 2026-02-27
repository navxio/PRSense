// packages/workflows/src/index/indexWorkflow.ts

import path from "node:path";
import { CoreEvents, EventBus, ContextChunk } from "@prsense/core";
import {
  FileSystemRepositorySource,
  GitHubRepositorySource,
  PostgresIndexMetadataRepository,
  GitLabRepositorySource,
} from "@prsense/context";
import { PRSENSE_VERSION } from "@prsense/core";
import type { IndexWorkflowResult } from "./types.js";
import type {
  ResolvedConfig,
  CredentialContext,
} from "@prsense/runtime-config";
import {
  createOpenAiEmbeddingClient,
  createOllamaEmbeddingClient,
} from "@prsense/llm";
import { PostgresRagChunkRepository } from "@prsense/context";
import {
  createCharChunker,
  detectKind,
  detectLanguage,
} from "@prsense/context";

//TODO: modularise this
export async function runIndexWorkflow({
  config,
  credentials,
  target,
  force,
  dryRun,
  eventBus,
}: {
  config: ResolvedConfig;
  credentials: CredentialContext;
  target: string;
  force?: boolean;
  dryRun?: boolean;
  eventBus: EventBus;
}): Promise<IndexWorkflowResult> {
  eventBus.emit(CoreEvents.WorkflowIndexStarted);

  try {
    // -------------------------------------------------
    // Resolve Repository Source
    // -------------------------------------------------

    let repositorySource;

    const isGithub = /github\.com/.test(target);
    const isGitlab = /gitlab\.com/.test(target);

    if (isGithub) {
      const match = target.match(/github\.com\/([^\/]+)\/([^\/]+)/);

      if (!match) {
        throw new Error("Invalid GitHub URL");
      }

      const owner = match[1];
      const repo = match[2];

      if (!owner || !repo) {
        throw new Error("Invalid GitHub repository url");
      }

      repositorySource = new GitHubRepositorySource(
        owner,
        repo.replace(".git", ""),
      );
    } else if (isGitlab) {
      const match = target.match(/gitlab\.com\/(.+?)\/([^\/]+)(?:\.git)?$/);

      if (!match) throw new Error("Invalid GitLab URL");

      const owner = match[1];
      const repo = match[2];
      if (!owner || !repo) throw new Error("Invalid GitLab repository url");
      repositorySource = new GitLabRepositorySource(
        owner,
        repo.replace(".git", ""),
      );
    } else {
      const absolute = path.resolve(target);
      repositorySource = new FileSystemRepositorySource(absolute);
    }

    // -------------------------------------------------
    // Resolve Identity + Revision
    // -------------------------------------------------

    const identity = repositorySource.getRepositoryIdentity();
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

    // -------------------------------------------------
    // Up-to-date Case
    // -------------------------------------------------

    if (!rebuildRequired) {
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

    // -------------------------------------------------
    // Outdated Case
    // -------------------------------------------------

    eventBus.emit(CoreEvents.WorkflowIndexOutdated, {
      commitSha: revision.commitSha,
    });

    if (dryRun) {
      eventBus.emit(CoreEvents.WorkflowIndexFinished);
      return {
        outcome: "success",
        payload: { chunksIndexed: 0 },
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
          commitSha: revision.commitSha,
          upToDate: false,
        },
      };
    }

    // -------------------------------------------------
    // Rebuild
    // -------------------------------------------------

    const files = await repositorySource.listFiles();
    if (files.length === 0) {
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

    const chunks: ContextChunk[] = [];
    for (const file of files) {
      try {
        const content = await repositorySource.readFile(file);
        const kind = detectKind(file);
        const language = detectLanguage(file);

        const fileChunks = chunker.chunk({
          content,
          source: { kind: "file", path: file },
        });

        for (const chunk of fileChunks) {
          const metadata: typeof chunk.metadata = {
            ...chunk.metadata,
            path: file,
            kind,
          };
          if (language !== undefined) metadata.language = language;
          chunk.metadata = metadata;
        }

        chunks.push(...fileChunks);
      } catch (err) {
        if (err instanceof Error && err.message === "BINARY_FILE_DETECTED") {
          eventBus.emit(CoreEvents.ContextFileSkipped, {
            path: file,
            reason: "binary",
          });
          continue;
        }

        throw err;
      }
    }

    eventBus.emit(CoreEvents.ContextChunksBuilt, {
      count: chunks.length,
    });

    // -------------------------------------------------
    // Delete Existing Chunks (Rebuild)
    // -------------------------------------------------

    await chunkRepository.deleteByRepository(identity.provider, identity.id);

    // -------------------------------------------------
    // Embed + Persist Chunks
    // -------------------------------------------------

    const allRows = [];

    const BATCH_SIZE = 16;

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

      allRows.push(...rows);
    }

    await chunkRepository.rebuildRepository(
      identity.provider,
      identity.id,
      allRows,
    );
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
        version: 1,
      },
      prsenseVersion: PRSENSE_VERSION,
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
