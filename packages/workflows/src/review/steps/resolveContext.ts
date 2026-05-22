// steps/resolveContext.ts

import { PostgresIndexMetadataRepository } from "@prsense/context";
import { CoreEvents } from "@prsense/core";
import { buildDiffEmbeddingQuery } from "../buildDiffEmbeddingQuery.js";

import { retrieveContext } from "../retrieveContext.js";

export async function resolveContext({
  config,
  repositoryIdentity,
  revision,
  metadata,
  diff,
  eventBus,
}: any) {
  const metadataRepository = new PostgresIndexMetadataRepository(
    config.database.url,
  );

  const storedMetadata = await metadataRepository.load(
    repositoryIdentity.provider,
    repositoryIdentity.id,
  );

  let contextualReviewAvailable = false;

  if (storedMetadata) {
    const embeddingMatches =
      storedMetadata.embedding.provider === config.embeddings.provider &&
      storedMetadata.embedding.model === config.embeddings.model;

    contextualReviewAvailable = embeddingMatches;

    if (!embeddingMatches || storedMetadata.revision.commitSha !== revision) {
      eventBus.emit(CoreEvents.WorkflowReviewIndexOutdated, {
        indexedCommit: storedMetadata.revision.commitSha,
        currentCommit: revision,
      });
    }
  } else {
    eventBus.emit(CoreEvents.WorkflowReviewContextUnavailable);
  }

  if (!contextualReviewAvailable) {
    return { contextText: "" };
  }

  eventBus.emit(CoreEvents.WorkflowReviewContextAvailable);

  const retrievalQuery = buildDiffEmbeddingQuery({
    diff,
    ...(metadata ?? {}),
  });

  const excludePaths = diff.files.map((f: { path: string }) => f.path);
  eventBus.emit(CoreEvents.WorkflowReviewContextQueryBuilt, {
    preview: retrievalQuery.slice(0, 500),
    excludePaths,
  });

  const retrieved = await retrieveContext({
    config,
    query: retrievalQuery,
    repoProvider: repositoryIdentity.provider,
    repoName: repositoryIdentity.id,
    limit: config.context.maxChunks,
    eventBus,
    excludePaths,
  });

  const MAX_CONTEXT_CHARS = 20000;

  let accumulated = "";
  for (const chunk of retrieved.chunks) {
    if (accumulated.length + chunk.content.length > MAX_CONTEXT_CHARS) break;
    accumulated += chunk.content + "\n\n";
  }

  eventBus.emit(CoreEvents.WorkflowReviewContextRetrieved, {
    chunks: retrieved.stats.totalChunks,
    truncated: retrieved.stats.truncated,
    contextChars: accumulated.length,
  });

  return { contextText: accumulated };
}
