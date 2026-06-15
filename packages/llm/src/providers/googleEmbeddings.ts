// packages/llm/src/providers/googleEmbeddings.ts
import { GoogleGenAI } from "@google/genai";
import type { EmbeddingClient } from "@prsense/core";

export function createGoogleEmbeddingClient(opts: {
  apiKey: string;
  model: string;
}): EmbeddingClient {
  /**
   * Migration note (2026):
   *
   * Google migrated from:
   *
   *   @google/generative-ai
   *
   * to:
   *
   *   @google/genai
   *
   * Key changes:
   *
   * - GoogleGenerativeAI -> GoogleGenAI
   * - getGenerativeModel() removed
   * - batchEmbedContents() removed
   * - ai.models.embedContent() now handles
   *   single and batch embedding requests
   *
   * Keep embedding behavior isolated in this
   * adapter so the indexing engine remains
   * provider-agnostic.
   */
  const ai = new GoogleGenAI({
    apiKey: opts.apiKey,
  });

  let cachedDimension: number | null = null;

  async function embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) {
      return [];
    }

    const response = await ai.models.embedContent({
      model: opts.model,
      contents: texts,
    });

    const embeddings = response.embeddings ?? [];

    return embeddings.map((embedding) => {
      if (!embedding.values) {
        throw new Error("Google returned an embedding without values");
      }

      return embedding.values;
    });
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

    /**
     * Conservative limit used by chunking logic.
     * Can be revisited if Gemini embedding limits
     * change in future releases.
     */
    maxInputChars: 6000,
  };
}
