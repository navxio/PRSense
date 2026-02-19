import fetch from "node-fetch";
import type { EmbeddingClient } from "../types.js";

export function createOllamaEmbeddingClient(opts: {
  baseUrl?: string;
  model: string;
}): EmbeddingClient {
  const baseUrl = opts.baseUrl ?? "http://localhost:11434";

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
  };
}
