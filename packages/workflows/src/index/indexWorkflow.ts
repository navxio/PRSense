import { indexRepository } from "@prsense/core";

import { createFilesystemRepositorySource } from "@prsense/adapters";

import {
  createPgVectorStore,
  createOllamaEmbeddingProvider,
} from "@prsense/context";
import { loadEnvConfig } from "@prsense/config";

type IndexWorkflowInput = {
  repoPath: string;
  chunkSize: number;
  chunkOverlap: number;
  debug: boolean;
};

export async function runIndexWorkflow(
  input: IndexWorkflowInput,
): Promise<number> {
  try {
    const env = loadEnvConfig(process.env);

    /* ---------------------------------- */
    /* Adapters                           */
    /* ---------------------------------- */

    const source = createFilesystemRepositorySource(input.repoPath);

    const embeddingProvider = createOllamaEmbeddingProvider({
      baseUrl: env.PRSENSE_OLLAMA_HOST,
      model: "nomic-embed-text",
    });

    const vectorStore = createPgVectorStore({
      connectionString: env.PRSENSE_DATABASE_URL,
    });

    /* ---------------------------------- */
    /* Execute indexing                   */
    /* ---------------------------------- */

    const result = await indexRepository({
      source,
      embeddingProvider,
      vectorStore,
      chunkSize: input.chunkSize,
      chunkOverlap: input.chunkOverlap,
      onDebugEvent: input.debug
        ? (event) => {
            switch (event.type) {
              case "file_discovered":
                console.log(`📄 ${event.path}`);
                break;

              case "chunk_created":
                console.log(
                  `  ↳ chunk ${event.startLine ?? "?"}-${event.endLine ?? "?"}`,
                );
                break;

              case "embedding_created":
                console.log(`    ↳ embedding (${event.vectorSize} dims)`);
                break;

              case "chunk_stored":
                console.log(`    ↳ stored ${event.chunkId}`);
                break;
            }
          }
        : undefined,
    });

    /* ---------------------------------- */
    /* Summary                            */
    /* ---------------------------------- */

    console.log("");
    console.log("Indexing complete:");
    console.log(`  Repo: ${result.repo.name}`);
    console.log(`  Files indexed: ${result.filesIndexed}`);
    console.log(`  Chunks created: ${result.chunksCreated}`);
    console.log(`  Chunks stored: ${result.chunksStored}`);

    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Indexing failed");
    return 1;
  }
}
