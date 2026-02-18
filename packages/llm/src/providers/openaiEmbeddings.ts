import OpenAI from "openai";
import type { EmbeddingClient } from "../types.js";

export function createOpenAiEmbeddingClient(opts: {
  apiKey: string;
  model: string;
}): EmbeddingClient {
  const client = new OpenAI({
    apiKey: opts.apiKey,
  });

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const response = await client.embeddings.create({
        model: opts.model,
        input: texts,
      });

      return response.data.map((d) => d.embedding);
    },
  };
}
