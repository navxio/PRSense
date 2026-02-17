// packages/workflows/src/index/runIndexWorkflow.ts

import path from "node:path";
import { CoreEvents, EventBus } from "@prsense/core";
import {
  FileSystemRepositorySource,
  GitHubRepositorySource,
  PostgresIndexMetadataRepository,
} from "@prsense/context";
import { PRSENSE_VERSION } from "@prsense/core";
import type { IndexWorkflowResult } from "./types.js";
import type { ResolvedConfig } from "@prsense/runtime-config";

export async function runIndexWorkflow({
  config,
  target,
  force,
  dryRun,
  eventBus,
}: {
  config: ResolvedConfig;
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

    const isGithub =
      target.startsWith("https://github.com") ||
      target.startsWith("http://github.com");

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

    const stored = await metadataRepository.load(
      identity.provider,
      identity.id,
    );

    // -------------------------------------------------
    // Compute Current Fingerprint
    // -------------------------------------------------

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
    const chunks = [];

    for (const file of files) {
      const content = await repositorySource.readFile(file);

      const lines = content.split("\n");
      const size = config.context.chunkSize;

      for (let i = 0; i < lines.length; i += size) {
        const chunkLines = lines.slice(i, i + size);
        const chunkContent = chunkLines.join("\n");

        chunks.push({
          id: `${file}:${i}`,
          source: { kind: "code", path: file },
          content: chunkContent,
          metadata: {
            path: file,
            lineStart: i + 1,
            lineEnd: i + chunkLines.length,
          },
        });
      }
    }

    eventBus.emit(CoreEvents.ContextChunksBuilt, {
      count: chunks.length,
    });

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
