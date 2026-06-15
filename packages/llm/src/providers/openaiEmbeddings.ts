//packages/llm/src/providers/openaiEmbeddings.ts
import OpenAI from "openai";
import type { EmbeddingClient } from "@prsense/core";

export function createOpenAiEmbeddingClient(opts: {
  apiKey: string;
  model: string;
}): EmbeddingClient {
  const client = new OpenAI({
    apiKey: opts.apiKey,
  });
  let cachedDimension: number | null = null;

  async function embed(texts: string[]): Promise<number[][]> {
    const response = await client.embeddings.create({
      model: opts.model,
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }
  async function detectDimension(): Promise<number> {
    if (cachedDimension !== null) return cachedDimension;

    const vectors = await embed(["dimension test"]);
    if (!vectors.length || !vectors[0]) {
      throw new Error("Failed to detect embedding dimension: empty response");
    }
    cachedDimension = vectors[0].length;
    return cachedDimension;
  }

  return {
    embed,
    dimension: detectDimension,
  };
}
