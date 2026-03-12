import type { ResolvedConfig } from "@prsense/config";

export const benchConfig: ResolvedConfig = {
  mode: "cli",

  repository: {
    root: "https://github.com/abcd",
    provider: "github",
  },

  llm: {
    provider: "ollama",
    model: "qwen2.5-coder",
    temperature: 0.05,
  },

  embeddings: {
    provider: "ollama",
    model: "nomic-embed-text",
  },

  review: {
    confidenceThreshold: 0.6,
    maxSignals: 10,
  },

  index: {
    chunkSizeChars: 1000,
    chunkOverlapChars: 200,
    maxFileSizeBytes: 1048576,
  },

  context: {
    maxChunks: 50,
  },

  database: {
    url: "postgresql://prsense:prsense@localhost:10000/prsense_dev",
    mode: "bundled",
  },
};
