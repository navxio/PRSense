// packages/llm/src/providers/openaiEmbeddings.ts
import OpenAI from "openai";
import type { EmbeddingClient } from "@prsense/core";

// OpenAI /v1/embeddings caps: ~300k tokens aggregate per request, 2048 array items.
// Leave headroom — our token estimate is approximate.
const MAX_TOKENS_PER_REQUEST = 150_000;
const MAX_INPUTS_PER_REQUEST = 2048;

// chars/2 deliberately OVER-estimates for code (denser than prose). Over-
// estimating is the safe direction: we pace slightly slower, never faster.
const estimateTokens = (s: string) => Math.ceil(s.length / 2);

// --- Rolling-window TPM governor (module-scoped: one shared budget across
// every embed() call, whether the indexer drives them serially or in parallel).
const WINDOW_MS = 60_000;
const DEFAULT_TPM_BUDGET = 800_000; // conservative start, under the common 1M default tier
const BUDGET_HEADROOM = 0.9; // use 90% of a discovered limit
const MAX_429_RETRIES = 6;

let tpmBudget = DEFAULT_TPM_BUDGET;
const spends: { at: number; tokens: number }[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function windowTokens(now: number): number {
  while (spends.length > 0 && now - spends[0]!.at > WINDOW_MS) spends.shift();
  return spends.reduce((a, s) => a + s.tokens, 0);
}

// Block until sending `tokens` keeps the trailing-60s total under budget.
// Escape hatch: if the window is empty we always proceed, so a single batch
// larger than the whole budget can't deadlock (packBatches caps per-request
// well below budget anyway).
async function reserve(tokens: number): Promise<void> {
  for (;;) {
    const now = Date.now();
    const used = windowTokens(now);
    if (used + tokens <= tpmBudget || spends.length === 0) {
      spends.push({ at: now, tokens });
      return;
    }
    const oldest = spends[0]!.at;
    await sleep(Math.max(WINDOW_MS - (now - oldest) + 50, 100));
  }
}

function parseTpmLimit(message: string): number | null {
  const m = message.match(/Limit\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function retryAfterMs(err: unknown, message: string): number {
  const headers = (err as { headers?: unknown }).headers;
  let header: string | null = null;
  if (headers instanceof Headers) {
    header = headers.get("retry-after");
  } else if (headers && typeof headers === "object") {
    const v = (headers as Record<string, unknown>)["retry-after"];
    if (typeof v === "string") header = v;
  }
  if (header) {
    const secs = Number(header);
    if (!Number.isNaN(secs)) return secs * 1000;
  }
  const m = message.match(/try again in ([\d.]+)s/i);
  if (m) return Math.ceil(Number(m[1]) * 1000);
  return 1000;
}

function* packBatches(
  texts: string[],
): Generator<{ slice: string[]; start: number }> {
  let batch: string[] = [];
  let tokens = 0;
  let start = 0;
  for (let i = 0; i < texts.length; i++) {
    const t = estimateTokens(texts[i]!);
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
  // We own retry/pacing, so the SDK must NOT silently retry 429s — otherwise
  // we never see the limit in the body to calibrate against.
  const client = new OpenAI({ apiKey: opts.apiKey, maxRetries: 0 });
  let cachedDimension: number | null = null;

  async function createBatch(slice: string[]) {
    const estTokens = slice.reduce((a, s) => a + estimateTokens(s), 0);
    for (let attempt = 0; ; attempt++) {
      await reserve(estTokens);
      try {
        return await client.embeddings.create({
          model: opts.model,
          input: slice,
        });
      } catch (err) {
        if (
          err instanceof OpenAI.APIError &&
          err.status === 429 &&
          attempt < MAX_429_RETRIES
        ) {
          const message = err.message ?? "";
          const limit = parseTpmLimit(message);
          if (limit) tpmBudget = Math.floor(limit * BUDGET_HEADROOM);
          await sleep(retryAfterMs(err, message));
          continue;
        }
        throw err;
      }
    }
  }

  async function embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const out: number[][] = new Array(texts.length);
    for (const { slice, start } of packBatches(texts)) {
      const response = await createBatch(slice);
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
