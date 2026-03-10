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
    chunkSizeChars: 1000,
    chunkOverlapChars: 200,
    maxFileSizeBytes: 1_000_000,
  },

  review: {
    confidenceThreshold: 0.6,
    maxSignals: 10,
  },

  context: {
    maxChunks: 5,
  },
};
