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
  type RagChunkRepository,
  type IndexMetadataRepository,
} from "@prsense/context";
import {
  createOpenAiEmbeddingClient,
  createOllamaEmbeddingClient,
} from "@prsense/llm";

type Params = {
  config: ResolvedConfig;
  repositoryIdentity: RepositoryIdentity;
  revision: string;
  diff: UnifiedDiff;
  eventBus: EventBus;
  chunks: RagChunkRepository;
  metadataRepo: IndexMetadataRepository;
};

type Result = {
  contextByFile: Map<string, ContextChunk[]>;
  contextualReviewAvailable: boolean;
};

export async function resolveContext(params: Params): Promise<Result> {
  const {
    config,
    repositoryIdentity,
    revision,
    diff,
    eventBus,
    chunks,
    metadataRepo,
  } = params;

  const embedClient =
    config.embeddings.provider === "openai"
      ? createOpenAiEmbeddingClient({
          apiKey: process.env.OPENAI_API_KEY!,
          model: config.embeddings.model,
        })
      : createOllamaEmbeddingClient({ model: config.embeddings.model });

  const providers: ContextProvider[] = [
    new RagContextProvider({
      chunks,
      metadata: metadataRepo,
      embedClient,
      embedding: {
        provider: config.embeddings.provider,
        model: config.embeddings.model,
      },
      maxChunks: config.context.maxChunks,
    }),
  ];

  const available: ContextProvider[] = [];
  for (const p of providers) {
    if (await p.isAvailable({ repositoryIdentity, revision, eventBus })) {
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
