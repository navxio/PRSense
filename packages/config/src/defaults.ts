export const defaults = {
  llm: {
    provider: "ollama",
    model: "qwen2.5-coder",
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
    confidenceThreshold: 0.6,
    maxSignals: 3,
  },

  context: {
    maxChunks: 5,
  },
};
