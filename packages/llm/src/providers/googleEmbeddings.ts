// packages/llm/src/providers/googleEmbeddings.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EmbeddingClient } from "../types.js";

export function createGoogleEmbeddingClient(opts: {
  apiKey: string;
  model: string;
}): EmbeddingClient {
  const genAI = new GoogleGenerativeAI(opts.apiKey);
  const model = genAI.getGenerativeModel({ model: opts.model });

  let cachedDimension: number | null = null;

  async function embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const response = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: "user", parts: [{ text }] },
      })),
    });

    return response.embeddings.map((e) => e.values);
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
