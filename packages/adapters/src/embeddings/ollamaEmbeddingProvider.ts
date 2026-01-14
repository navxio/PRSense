import { EmbeddingProvider, EmbeddingVector } from "@prsense/context";

type OllamaEmbeddingConfig = {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
};

type OllamaEmbeddingResponse = {
  embedding: number[];
};

const embedWithOllama =
  (config: OllamaEmbeddingConfig) =>
  async (text: string): Promise<EmbeddingVector> => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.timeoutMs ?? 30_000,
    );

    try {
      const res = await fetch(`${config.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Ollama embedding failed (${res.status}): ${body}`);
      }

      const data = (await res.json()) as OllamaEmbeddingResponse;

      if (!Array.isArray(data.embedding)) {
        throw new Error("Invalid embedding response from Ollama");
      }

      return data.embedding;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new Error("Ollama embedding request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

export const createOllamaEmbeddingProvider = (
  config: OllamaEmbeddingConfig,
): EmbeddingProvider => ({
  embed: embedWithOllama(config),
});
