// packages/workflows/src/review/steps/resolveContext.ts
import {
  CoreEvents,
  type UnifiedDiff,
  type ContextChunk,
  type ContextProvider,
  type EventBus,
  type RepositoryIdentity,
} from "@prsense/core";
import type { ResolvedConfig } from "@prsense/config";
import {
  RagContextProvider,
  SymbolGraphContextProvider,
  type RagChunkRepository,
  type IndexMetadataRepository,
  type ResolvedContext,
} from "@prsense/context";
import {
  createOpenAiEmbeddingClient,
  createOllamaEmbeddingClient,
} from "@prsense/llm";
import type { ReviewMetadata } from "../types.js";

type ResolveContextParams = {
  config: ResolvedConfig;
  repositoryIdentity: RepositoryIdentity;
  revision: string;
  baseRevision: string;
  diff: UnifiedDiff;
  eventBus: EventBus;
  repository: RagChunkRepository; // was: chunks
  metadataRepository: IndexMetadataRepository; // was: metadataRepo
  metadata?: ReviewMetadata; // NEW — PR title/description for the query
  providers?: ContextProvider[];
};

export async function resolveContext(
  params: ResolveContextParams,
): Promise<ResolvedContext> {
  const {
    config,
    repositoryIdentity,
    revision,
    diff,
    eventBus,
    repository,
    metadataRepository,
    metadata,
  } = params;

  let providers: ContextProvider[];
  if (params.providers) {
    providers = params.providers;
  } else {
    const embedClient =
      config.embeddings.provider === "openai"
        ? createOpenAiEmbeddingClient({
            apiKey: process.env.PRSENSE_OPENAI_API_KEY!,
            model: config.embeddings.model,
          })
        : createOllamaEmbeddingClient({ model: config.embeddings.model });

    providers = [
      new RagContextProvider({
        chunks: repository,
        metadata: metadataRepository,
        embedClient,
        embedding: {
          provider: config.embeddings.provider,
          model: config.embeddings.model,
        },
        maxChunks: config.context.maxChunks,
        ...(metadata ? { prMetadata: metadata } : {}),
      }),
      new SymbolGraphContextProvider({
        repoRoot: config.repository.root,
        baseSha: params.baseRevision,
      }),
    ];
  }

  const available: ContextProvider[] = [];
  for (const p of providers) {
    if (await p.isAvailable({ repositoryIdentity, revision, eventBus, diff })) {
      available.push(p);
    }
  }

  if (available.length === 0) {
    return { contextByFile: new Map(), contextualReviewAvailable: false };
  }

  eventBus.emit(CoreEvents.WorkflowReviewContextAvailable);

  const contextByFile = new Map<string, ContextChunk[]>();
  for (const file of diff.files) {
    const collected: ContextChunk[] = [];
    for (const p of available) {
      const result = await p.getContextForFile({
        file,
        diff,
        repositoryIdentity,
        revision,
        eventBus,
      });
      collected.push(...result);
    }
    contextByFile.set(file.path, collected);
  }

  return { contextByFile, contextualReviewAvailable: true };
}
