// packages/workflows/src/review/retrieveContext.ts

import type { RetrievedContext, EventBus, ContextChunk } from "@prsense/core";
import { CoreEvents } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/config";
import { PostgresRagChunkRepository } from "@prsense/context";
import {
  createOpenAiEmbeddingClient,
  createOllamaEmbeddingClient,
} from "@prsense/llm";

export async function retrieveContext(params: {
  config: ResolvedConfig;
  query: string;
  repoProvider: string;
  repoName: string;
  repoRef?: string;
  limit: number;
  excludePaths?: string[];
  eventBus?: EventBus;
}): Promise<RetrievedContext> {
  const {
    config,
    query,
    repoProvider,
    repoName,
    repoRef,
    limit,
    excludePaths,
  } = params;

  // -------------------------------------------------
  // Create embedding client
  // -------------------------------------------------

  const embeddingClient =
    config.embeddings.provider === "openai"
      ? createOpenAiEmbeddingClient({
          apiKey: process.env.OPENAI_API_KEY!,
          model: config.embeddings.model,
        })
      : createOllamaEmbeddingClient({
          model: config.embeddings.model,
        });

  const [queryEmbedding] = await embeddingClient.embed([query]);

  params.eventBus?.emit(CoreEvents.WorkflowReviewContextEmbeddingGenerated, {
    dimension: queryEmbedding?.length,
  });

  if (!queryEmbedding) {
    throw new Error("Failed to generate query embedding");
  }

  // -------------------------------------------------
  // Query RAG store
  // -------------------------------------------------

  const repository = new PostgresRagChunkRepository(config.database.url);

  const rows = await repository.searchNearest({
    repoProvider,
    repoName,
    ...(repoRef ? { repoRef } : {}),
    embedding: queryEmbedding,
    limit,
    ...(excludePaths && excludePaths.length > 0 ? { excludePaths } : {}),
  });

  params.eventBus?.emit(CoreEvents.WorkflowReviewContextRetrieved, {
    chunks: rows.length,
    repoProvider,
    repoName,
    minDistance: rows[0]?.distance,
    maxDistance: rows[rows.length - 1]?.distance,
  });

  // -------------------------------------------------
  // Map to domain objects
  // -------------------------------------------------

  const chunks: ContextChunk[] = rows.map((row) => {
    const chunk: ContextChunk = {
      id: row.id,
      source: {
        kind: "file",
        path: row.path,
      },
      content: row.content,
      metadata: {
        path: row.path,
        ...(row.lineStart != null ? { lineStart: row.lineStart } : {}),
        ...(row.lineEnd != null ? { lineEnd: row.lineEnd } : {}),
        ...(row.language != null ? { language: row.language } : {}),
      },
    };

    params.eventBus?.emit(CoreEvents.WorkflowReviewContextChunkRetrieved, {
      source: chunk.source,
      metadata: chunk.metadata,
      distance: row.distance,
    });

    return chunk;
  });

  return {
    chunks,
    stats: {
      totalChunks: rows.length,
      truncated: rows.length === limit,
    },
  };
}
