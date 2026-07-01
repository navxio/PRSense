// packages/llm/src/embeddings/concurrency.ts
import type { EmbeddingProvider } from "./batchSize.js";

export function defaultConcurrency(provider: EmbeddingProvider): number {
  switch (provider) {
    case "openai":
      return 6;
    case "google":
      return 1; // tighter rate limits in practice
    case "ollama":
      return 1; // serial; one GPU
  }
}
