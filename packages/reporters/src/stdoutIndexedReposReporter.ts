import type { OutputReporter } from "./types.js";
import type { IndexedRepository } from "@prsense/core";

export const stdoutIndexedReposReporter: OutputReporter<IndexedRepository[]> = {
  async report(repos) {
    if (repos.length === 0) {
      console.log("No repositories indexed.");
      return;
    }

    console.log("");
    console.log("Indexed repositories:");
    console.log("");

    for (const repo of repos) {
      const date = new Date(repo.indexedAt).toISOString();

      console.log(`${repo.provider}/${repo.repository}`);
      console.log(`  commit: ${repo.commitSha}`);
      console.log(
        `  embeddings: ${repo.embeddingProvider}/${repo.embeddingModel}`,
      );
      console.log(`  indexed: ${date}`);
      console.log("");
    }
  },
};
