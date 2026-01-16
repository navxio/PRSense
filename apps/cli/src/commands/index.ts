import { Command } from "commander";

import { indexRepository } from "@prsense/engine";
import { createFilesystemRepositorySource } from "@prsense/adapters";
import {
  createPgVectorStore,
  createOllamaEmbeddingProvider,
} from "@prsense/adapters";

export const indexCommand = new Command("index")
  .argument("<path>", "Path to repository")
  .option("--debug", "Enable indexing debug output")
  .option("--chunk-size <n>", "Chunk size (lines)", "80")
  .option("--chunk-overlap <n>", "Chunk overlap (lines)", "10")
  .action(async (path, options) => {
    const chunkSize = Number(options.chunkSize);
    const chunkOverlap = Number(options.chunkOverlap);

    if (Number.isNaN(chunkSize) || Number.isNaN(chunkOverlap)) {
      console.error("chunk-size and chunk-overlap must be numbers");
      process.exit(1);
    }

    /* ---------------------------------- */
    /* Adapters                           */
    /* ---------------------------------- */

    const source = createFilesystemRepositorySource(path);

    const embeddingProvider = createOllamaEmbeddingProvider({
      baseUrl: "http://localhost:11434",
      model: "nomic-embed-text",
    });

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const vectorStore = createPgVectorStore(pool);

    /* ---------------------------------- */
    /* Execute indexing                   */
    /* ---------------------------------- */

    const result = await indexRepository({
      source,
      embeddingProvider,
      vectorStore,
      chunkSize,
      chunkOverlap,
      onDebugEvent: options.debug
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

    console.log("");
    console.log("Indexing complete:");
    console.log(`  Repo: ${result.repo.name}`);
    console.log(`  Files indexed: ${result.filesIndexed}`);
    console.log(`  Chunks created: ${result.chunksCreated}`);
    console.log(`  Chunks stored: ${result.chunksStored}`);

    await pool.end();
  });
