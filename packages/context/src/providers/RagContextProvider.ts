// packages/context/src/providers/rag/RagContextProvider.ts
import {
  CoreEvents,
  type ContextChunk,
  type ContextProvider,
  type ContextInput,
  type ContextAvailabilityInput,
} from "@prsense/core";
import { EmbeddingClient } from "@prsense/core";
import { RagChunkRepository } from "../rag/RagChunkRepository.js";
import { IndexMetadataRepository } from "../index/IndexMetadataRepository.js";
import { buildFileEmbeddingQuery } from "../rag/buildFileEmbeddingQuery.js";
export class RagContextProvider implements ContextProvider {
  readonly name = "rag";

  constructor(
    private deps: {
      chunks: RagChunkRepository;
      metadata: IndexMetadataRepository;
      embedClient: EmbeddingClient;
      embedding: { provider: string; model: string };
      maxChunks: number;
      prMetadata?: { title?: string };
    },
  ) {}

  async isAvailable(input: ContextAvailabilityInput): Promise<boolean> {
    const { metadata, embedding } = this.deps;
    const stored = await metadata.load(
      input.repositoryIdentity.provider,
      input.repositoryIdentity.id,
    );

    if (!stored) {
      input.eventBus?.emit(CoreEvents.WorkflowReviewContextUnavailable);
      return false;
    }

    const embeddingMatches =
      stored.embedding.provider === embedding.provider &&
      stored.embedding.model === embedding.model;

    if (!embeddingMatches || stored.revision.commitSha !== input.revision) {
      input.eventBus?.emit(CoreEvents.WorkflowReviewIndexOutdated, {
        indexedCommit: stored.revision.commitSha,
        currentCommit: input.revision,
      });
    }

    return embeddingMatches;
  }

  async getContextForFile(input: ContextInput): Promise<ContextChunk[]> {
    const { chunks, embedClient, maxChunks } = this.deps;

    const query = buildFileEmbeddingQuery({
      file: input.file,
      ...(this.deps.prMetadata ? { prMetadata: this.deps.prMetadata } : {}),
    });
    const [queryEmbedding] = await embedClient.embed([query]);
    if (!queryEmbedding) {
      throw new Error("Failed to generate query embedding");
    }

    input.eventBus?.emit(CoreEvents.WorkflowReviewContextEmbeddingGenerated, {
      dimension: queryEmbedding.length,
      file: input.file.path,
    });

    const excludePaths = input.diff.files.map((f) => f.path);

    const rows = await chunks.searchNearest({
      repoProvider: input.repositoryIdentity.provider,
      repoName: input.repositoryIdentity.id,
      embedding: queryEmbedding,
      limit: maxChunks,
      ...(excludePaths.length > 0 ? { excludePaths } : {}),
    });

    input.eventBus?.emit(CoreEvents.WorkflowReviewContextRetrieved, {
      file: input.file.path,
      chunks: rows.length,
      minDistance: rows[0]?.distance,
      maxDistance: rows[rows.length - 1]?.distance,
    });

    return rows.map((row) => ({
      id: row.id,
      source: { kind: "file" as const, path: row.path },
      content: row.content,
      provider: "rag" as const,
      metadata: {
        path: row.path,
        ...(row.lineStart != null ? { lineStart: row.lineStart } : {}),
        ...(row.lineEnd != null ? { lineEnd: row.lineEnd } : {}),
        ...(row.language != null ? { language: row.language } : {}),
      },
    }));
  }
}
