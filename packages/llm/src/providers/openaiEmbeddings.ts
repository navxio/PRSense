// packages/llm/src/providers/openaiEmbeddings.ts
import OpenAI from "openai";
import type { EmbeddingClient } from "@prsense/core";

// OpenAI /v1/embeddings caps: ~300k tokens aggregate per request, 2048 array items.
// Leave headroom — our token estimate is approximate.
const MAX_TOKENS_PER_REQUEST = 150_000;
const MAX_INPUTS_PER_REQUEST = 2048;

// chars/4 is the standard rough estimate for mixed English + code.
const estimateTokens = (s: string) => Math.ceil(s.length / 2);

function* packBatches(
  texts: string[],
): Generator<{ slice: string[]; start: number }> {
  let batch: string[] = [];
  let tokens = 0;
  let start = 0;
  for (let i = 0; i < texts.length; i++) {
    const t = estimateTokens(texts[i]!);
    // Oversized single input: emit alone. Let the API surface the error
    // rather than silently dropping or crashing the whole run.
    if (t > MAX_TOKENS_PER_REQUEST) {
      if (batch.length) {
        yield { slice: batch, start };
        batch = [];
        tokens = 0;
      }
      yield { slice: [texts[i]!], start: i };
      start = i + 1;
      continue;
    }
    if (
      tokens + t > MAX_TOKENS_PER_REQUEST ||
      batch.length >= MAX_INPUTS_PER_REQUEST
    ) {
      yield { slice: batch, start };
      start = i;
      batch = [];
      tokens = 0;
    }
    batch.push(texts[i]!);
    tokens += t;
  }
  if (batch.length) yield { slice: batch, start };
}

export function createOpenAiEmbeddingClient(opts: {
  apiKey: string;
  model: string;
}): EmbeddingClient {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    maxRetries: 8,
  });
  let cachedDimension: number | null = null;

  async function embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const out: number[][] = new Array(texts.length);
    for (const { slice, start } of packBatches(texts)) {
      const estTok = slice.reduce((a, s) => a + Math.ceil(s.length / 4), 0);
      const response = await client.embeddings.create({
        model: opts.model,
        input: slice,
      });
      response.data.forEach((d, j) => {
        out[start + j] = d.embedding;
      });
    }
    return out;
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
    maxInputChars: 28000,
  };
}
