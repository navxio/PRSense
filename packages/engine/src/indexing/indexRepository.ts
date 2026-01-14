import {
  RepositorySource,
  EmbeddingProvider,
  VectorStore,
  Chunk,
} from "@prsense/context";
import { IndexDebugEvent } from "@prsense/context";
import { chunkText } from "./chunkFile.js";

export type IndexRepositoryParams = {
  source: RepositorySource;
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;

  chunkSize: number;
  chunkOverlap: number;

  onDebugEvent?: (event: IndexDebugEvent) => void;
};

export type IndexRepositoryResult = {
  repo: RepositorySource["id"];
  filesIndexed: number;
  chunksCreated: number;
  chunksStored: number;
};

export const indexRepository = async (
  params: IndexRepositoryParams,
): Promise<IndexRepositoryResult> => {
  const {
    source,
    embeddingProvider,
    vectorStore,
    chunkSize,
    chunkOverlap,
    onDebugEvent,
  } = params;

  const files = await source.listFiles();

  let chunksCreated = 0;
  let chunksStored = 0;

  const allChunks: Chunk[] = [];

  for (const file of files) {
    onDebugEvent?.({
      type: "file_discovered",
      path: file.path,
      kind: file.kind,
    });

    const content = await source.readFile(file.path);

    const chunks = chunkText({
      repoId: source.id,
      path: file.path,
      kind: file.kind,
      language: file.language,
      content,
      chunkSize,
      chunkOverlap,
    });

    for (const chunk of chunks) {
      onDebugEvent?.({
        type: "chunk_created",
        path: chunk.path,
        ...(chunk.lineStart !== undefined && {
          startLine: chunk.lineStart,
        }),
        ...(chunk.lineEnd !== undefined && {
          endLine: chunk.lineEnd,
        }),
      });
    }

    chunksCreated += chunks.length;
    allChunks.push(...chunks);
  }

  // Embed + store (sequential for MVP clarity)
  const storedChunks = [];

  for (const chunk of allChunks) {
    const embedding = await embeddingProvider.embed(chunk.content);

    onDebugEvent?.({
      type: "embedding_created",
      chunkId: chunk.id,
      vectorSize: embedding.length,
    });

    storedChunks.push({
      ...chunk,
      embedding,
      indexedAt: new Date(),
    });
  }

  await vectorStore.upsert(storedChunks);

  for (const chunk of storedChunks) {
    onDebugEvent?.({
      type: "chunk_stored",
      chunkId: chunk.id,
    });
  }

  chunksStored = storedChunks.length;

  return {
    repo: source.id,
    filesIndexed: files.length,
    chunksCreated,
    chunksStored,
  };
};
