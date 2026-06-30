// packages/llm/src/providers/__tests__/ollamaEmbeddings.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("node-fetch", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import fetch from "node-fetch";
import { createOllamaEmbeddingClient } from "../ollamaEmbeddings.js";

const mockedFetch = jest.mocked(fetch);

function okEmbedding(dim = 3) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ embedding: Array(dim).fill(0.1) }),
    text: async () => "",
  } as any;
}

function contextOverflow500() {
  return {
    ok: false,
    status: 500,
    json: async () => ({}),
    text: async () =>
      JSON.stringify({ error: "the input length exceeds the context length" }),
  } as any;
}

function genericError(status: number, msg: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => msg,
  } as any;
}

function promptOf(callIndex: number): string {
  const init = mockedFetch.mock.calls[callIndex]![1] as { body: string };
  return JSON.parse(init.body).prompt;
}

function newClient() {
  return createOllamaEmbeddingClient({ model: "nomic-embed-text" });
}

describe("createOllamaEmbeddingClient", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("clamps an oversized input to MAX_INPUT_CHARS on the first request", async () => {
    mockedFetch.mockResolvedValue(okEmbedding());
    const client = newClient();

    await client.embed(["x".repeat(10_000)]);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(promptOf(0).length).toBe(3000);
  });

  it("retries with a shorter prompt on the context-length 500", async () => {
    mockedFetch
      .mockResolvedValueOnce(contextOverflow500())
      .mockResolvedValueOnce(okEmbedding());
    const client = newClient();

    const [vec] = await client.embed(["y".repeat(1000)]);

    expect(vec).toHaveLength(3);
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(promptOf(1).length).toBeLessThan(promptOf(0).length);
  });

  it("keeps halving until the input fits", async () => {
    mockedFetch
      .mockResolvedValueOnce(contextOverflow500())
      .mockResolvedValueOnce(contextOverflow500())
      .mockResolvedValueOnce(okEmbedding());
    const client = newClient();

    await client.embed(["z".repeat(3000)]);

    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(promptOf(1).length).toBeLessThan(promptOf(0).length);
    expect(promptOf(2).length).toBeLessThan(promptOf(1).length);
  });

  it("surfaces the error once it can't shrink below the floor", async () => {
    mockedFetch.mockResolvedValue(contextOverflow500());
    const client = newClient();

    await expect(client.embed(["w".repeat(300)])).rejects.toThrow(
      /context length/i,
    );
    // 300 -> floor(256) -> throw: bounded, never loops forever.
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces a non-context 500 immediately without retrying", async () => {
    mockedFetch.mockResolvedValue(genericError(500, "model not found"));
    const client = newClient();

    await expect(client.embed(["anything"])).rejects.toThrow(/model not found/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("routes the dimension probe through the same guarded path", async () => {
    mockedFetch.mockResolvedValue(okEmbedding(768));
    const client = newClient();

    expect(await client.dimension()).toBe(768);
  });
});
