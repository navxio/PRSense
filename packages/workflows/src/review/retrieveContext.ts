// packages/workflows/src/review/retrieveContext.ts

import type { RetrievedContext } from "@prsense/core";
import type { ResolvedConfig } from "@prsense/runtime-config";
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
}): Promise<RetrievedContext> {
  const { config, query, repoProvider, repoName, repoRef, limit } = params;

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
  });

  // -------------------------------------------------
  // Map to domain objects
  // -------------------------------------------------

  return {
    chunks: rows.map((row) => ({
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
    })),
    stats: {
      totalChunks: rows.length,
      truncated: rows.length === limit,
    },
  };
}
