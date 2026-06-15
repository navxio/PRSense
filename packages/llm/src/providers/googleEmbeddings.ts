// packages/llm/src/providers/googleEmbeddings.ts

import { GoogleGenAI } from "@google/genai";
import type { EmbeddingClient } from "@prsense/core";

export function createGoogleEmbeddingClient(opts: {
  apiKey: string;
  model: string;
}): EmbeddingClient {
  const ai = new GoogleGenAI({
    apiKey: opts.apiKey,
  });

  let cachedDimension: number | null = null;

  async function embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const response = await ai.models.embedContent({
      model: opts.model,
      contents: texts,
    });

    return response.embeddings.map((e) => e.values);
  }

  async function detectDimension(): Promise<number> {
    if (cachedDimension !== null) {
      return cachedDimension;
    }

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
    maxInputChars: 6000,
  };
}
