// packages/llm/src/providers/ollamaEmbeddings.ts
import fetch from "node-fetch";
import type { EmbeddingClient } from "@prsense/core";

const MAX_INPUT_CHARS = 3000; // proactive clamp (fast path)
const MIN_INPUT_CHARS = 256; // floor; below this, surface the error honestly

export function createOllamaEmbeddingClient(opts: {
  baseUrl?: string;
  model: string;
}): EmbeddingClient {
  const baseUrl = opts.baseUrl ?? "http://localhost:11434";
  let cachedDimension: number | null = null;

  async function callEmbedding(prompt: string): Promise<Response> {
    return fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: opts.model, prompt }),
    }) as unknown as Promise<Response>;
  }

  async function embedOne(text: string): Promise<number[]> {
    let input =
      text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

    for (;;) {
      const res = await callEmbedding(input);
      if (res.ok) {
        const json = (await res.json()) as { embedding: number[] };
        return json.embedding;
      }

      const body = await res.text().catch(() => "");
      const contextOverflow =
        res.status === 500 &&
        /context length|input length exceeds/i.test(body) &&
        input.length > MIN_INPUT_CHARS;

      if (contextOverflow) {
        input = input.slice(
          0,
          Math.max(MIN_INPUT_CHARS, Math.floor(input.length / 2)),
        );
        continue;
      }
      throw new Error(`Ollama embedding error: ${res.status} ${body}`);
    }
  }

  async function detectDimension(): Promise<number> {
    if (cachedDimension !== null) return cachedDimension;
    const embedding = await embedOne("dimension test");
    cachedDimension = embedding.length;
    return cachedDimension;
  }

  return {
    async embed(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await embedOne(text));
      }
      return results;
    },
    dimension: detectDimension,
    maxInputChars: MAX_INPUT_CHARS,
  };
}
