import fetch from "node-fetch";
import type { EmbeddingClient } from "../types.js";

export function createOllamaEmbeddingClient(opts: {
  baseUrl?: string;
  model: string;
}): EmbeddingClient {
  const baseUrl = opts.baseUrl ?? "http://localhost:11434";
  let cachedDimension: number | null = null;
  async function detectDimension(): Promise<number> {
    if (cachedDimension !== null) return cachedDimension;

    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        prompt: "dimension test",
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Ollama embedding dimension detection failed: ${res.status}`,
      );
    }

    const json = (await res.json()) as { embedding: number[] };

    cachedDimension = json.embedding.length;
    return cachedDimension;
  }

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];

      for (const text of texts) {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: opts.model,
            prompt: text,
          }),
        });

        if (!res.ok) {
          throw new Error(
            `Ollama embedding error: ${res.status} ${await res.text()}`,
          );
        }

        const json = (await res.json()) as {
          embedding: number[];
        };

        results.push(json.embedding);
      }

      return results;
    },
    dimension: detectDimension,
  };
}
