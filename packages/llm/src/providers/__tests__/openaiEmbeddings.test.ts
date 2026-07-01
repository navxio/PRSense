// packages/llm/src/providers/__tests__/openaiEmbeddings.test.ts
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Stable across resetModules so the SUT's `instanceof OpenAI.APIError` holds.
class mockAPIError extends Error {
  status: number;
  headers: unknown;
  constructor(status: number, message: string, headers?: unknown) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

type EmbeddingsCreate = (args: {
  input: string[];
}) => Promise<{ data: { embedding: number[] }[] }>;

const mockCreate = jest.fn<EmbeddingsCreate>();

jest.mock("openai", () => {
  const OpenAI: any = jest.fn(() => ({ embeddings: { create: mockCreate } }));
  OpenAI.APIError = mockAPIError;
  return { __esModule: true, default: OpenAI };
});

async function freshClient() {
  const mod = await import("../openaiEmbeddings.js");
  return mod.createOpenAiEmbeddingClient({
    apiKey: "k",
    model: "text-embedding-3-small",
  });
}

const okData = (input: string[]) => ({
  data: input.map((s) => ({ embedding: [s.length] })),
});

describe("createOpenAiEmbeddingClient", () => {
  beforeEach(() => {
    jest.resetModules(); // fresh tpmBudget + spends per test
    mockCreate.mockReset();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("embeds a batch and preserves input order", async () => {
    mockCreate.mockImplementation(async ({ input }: { input: string[] }) =>
      okData(input),
    );
    const client = await freshClient();

    const out = await client.embed(["a", "bb", "ccc"]);

    expect(out).toEqual([[1], [2], [3]]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("splits into multiple requests past the array-item cap, keeping order", async () => {
    mockCreate.mockImplementation(async ({ input }: { input: string[] }) =>
      okData(input),
    );
    const client = await freshClient();

    // 2049 inputs -> [2048] + [1]; each embedding encodes its own length.
    const inputs = Array.from({ length: 2049 }, (_, i) =>
      "x".repeat((i % 5) + 1),
    );
    const out = await client.embed(inputs);

    expect(out).toHaveLength(2049);
    expect(out[0]).toEqual([1]); // first item of batch 1
    expect(out[2048]).toEqual([(2048 % 5) + 1]); // first item of batch 2
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("calibrates to the reported TPM limit and retries after a 429", async () => {
    mockCreate
      .mockRejectedValueOnce(
        new mockAPIError(
          429,
          "Rate limit reached ... on tokens per min (TPM): Limit 1000000, Used 989105, Requested 80435. Please try again in 1s.",
          {},
        ),
      )
      .mockResolvedValueOnce({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    const client = await freshClient();

    const p = client.embed(["hello"]);
    await jest.advanceTimersByTimeAsync(1000); // honor "try again in 1s"
    const out = await p;

    expect(out).toEqual([[0.1, 0.2, 0.3]]);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("surfaces a non-429 error immediately without retrying", async () => {
    mockCreate.mockRejectedValue(new mockAPIError(400, "invalid input", {}));
    const client = await freshClient();

    await expect(client.embed(["x"])).rejects.toThrow(/invalid input/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("reads retry-after from a Headers instance when the body omits the delay", async () => {
    mockCreate
      .mockRejectedValueOnce(
        new mockAPIError(
          429,
          "rate limited",
          new Headers({ "retry-after": "2" }),
        ),
      )
      .mockResolvedValueOnce({ data: [{ embedding: [1] }] });
    const client = await freshClient();

    const p = client.embed(["x"]);
    await jest.advanceTimersByTimeAsync(2000); // 2s from the header
    await expect(p).resolves.toEqual([[1]]);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("detects the embedding dimension once and caches it", async () => {
    mockCreate.mockResolvedValue({ data: [{ embedding: [0, 0, 0, 0] }] });
    const client = await freshClient();

    expect(await client.dimension()).toBe(4);
    expect(await client.dimension()).toBe(4);
    expect(mockCreate).toHaveBeenCalledTimes(1); // second call served from cache
  });
});
