import {
  RepositorySource,
  EmebeddingProvider,
  VectorStore,
  IndexEventSink,
} from "@prsense/context";

export type IndexWorkflowInput = {
  /** Resolved intent (slice, not whole config) */
  intent: {
    repository: {
      root: string;
    };
    context: {
      maxChunks: number;
      chunkSize: number;
      chunkOverlap: number;
    };
  };

  /** Explicit ports */
  repositorySource: RepositorySource;
  embeddingProvider: EmbeddingProvider;
  vectorStore: VectorStore;

  /** Optional diagnostics */
  onEvent?: IndexEventSink;
};

export async function runIndexWorkflow(input: IndexWorkflowInput): Promise<{
  filesIndexed: number;
  chunksCreated: number;
  chunksStored: number;
}> {
  /* implementation */
}
