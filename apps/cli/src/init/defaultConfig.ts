export const DEFAULT_CONFIG = {
  llm: {
    provider: "ollama",
    model: "qwen2.5-coder",
    temperature: 0.1,
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
  },
  context: {
    maxChunks: 5,
  },
  git: {
    baseBranch: "main",
  },
  delivery: {
    platform: "github",
  },
};