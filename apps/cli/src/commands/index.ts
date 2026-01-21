import { Command } from "commander";
import { runIndexWorkflow } from "@prsense/workflows";

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

    const exitCode = await runIndexWorkflow({
      repoPath: path,
      chunkSize,
      chunkOverlap,
      debug: Boolean(options.debug),
    });

    process.exit(exitCode);
  });
