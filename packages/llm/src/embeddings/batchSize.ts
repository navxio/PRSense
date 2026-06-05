export type EmbeddingProvider = "openai" | "ollama" | "google";

export function defaultBatchSize(provider: EmbeddingProvider): number {
  switch (provider) {
    case "openai":
      return 512;
    case "google":
      return 100;
    case "ollama":
      return 16;
  }
}
