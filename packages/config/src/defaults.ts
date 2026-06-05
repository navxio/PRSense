export const defaults = {
  llm: {
    provider: "ollama",
    model: "deepseek-coder-v2",
    temperature: 0.1,
  },

  embeddings: {
    provider: "ollama",
    model: "nomic-embed-text",
  },

  index: {
    auto: true,
    chunkSizeChars: 1000,
    chunkOverlapChars: 200,
  },

  review: {
    confidenceThreshold: 0.8,
    maxSignals: 3,
  },

  git: {
    baseBranch: "main",
  },

  context: {
    maxChunks: 5,
  },
};
