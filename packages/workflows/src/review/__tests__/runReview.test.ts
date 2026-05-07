//packages/workflows/src/review/__tests__/runReview.test.ts

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

import { CoreEvents } from "@prsense/core";

import { runReview } from "../steps/runReview.js";

jest.mock("../lib/runFileReview.js", () => ({
  runFileReview: jest.fn(),
}));

import { runFileReview } from "../lib/runFileReview.js";

const mockedRunFileReview = jest.mocked(runFileReview);

class TestEventBus {
  events: Array<{ event: string; fields?: unknown }> = [];

  emit(event: string, fields?: unknown) {
    this.events.push({ event, fields });
  }
}

function createFile(path: string) {
  return {
    path,
    patch: "diff --git a/file b/file\n+const x = 1;",
  };
}

function createConfig(overrides: Record<string, unknown> = {}) {
  return {
    llm: {
      provider: "openai",
      model: "gpt-4.1",
    },
    review: {
      concurrency: 4,
    },
    ...overrides,
  };
}

describe("runReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates signals from all concurrent reviews", async () => {
    mockedRunFileReview
      .mockResolvedValueOnce({
        outcome: "success",
        file: "a.ts",
        signals: [
          {
            severity: "high",
            title: "signal-a",
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        outcome: "success",
        file: "b.ts",
        signals: [
          {
            severity: "medium",
            title: "signal-b",
          },
        ],
      } as never);

    const result = await runReview({
      files: [createFile("a.ts"), createFile("b.ts")],
      llmClient: {},
      contextText: "ctx",
      config: createConfig(),
      metadata: {
        title: "Test PR",
      },
      eventBus: new TestEventBus(),
    });

    expect(result.allSignals).toHaveLength(2);

    expect(result.allSignals.map((s: any) => s.title)).toEqual([
      "signal-a",
      "signal-b",
    ]);
  });

  it("aggregates token usage across concurrent reviews", async () => {
    mockedRunFileReview
      .mockResolvedValueOnce({
        outcome: "success",
        file: "a.ts",
        signals: [],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      } as never)
      .mockResolvedValueOnce({
        outcome: "success",
        file: "b.ts",
        signals: [],
        usage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
      } as never);

    const result = await runReview({
      files: [createFile("a.ts"), createFile("b.ts")],
      llmClient: {},
      contextText: "ctx",
      config: createConfig(),
      eventBus: new TestEventBus(),
    });

    expect(result.totalUsage).toEqual({
      promptTokens: 30,
      completionTokens: 15,
      totalTokens: 45,
    });
  });

  it("continues reviewing remaining files when one file fails", async () => {
    mockedRunFileReview
      .mockResolvedValueOnce({
        outcome: "failure",
        file: "a.ts",
        error: "boom",
      } as never)
      .mockResolvedValueOnce({
        outcome: "success",
        file: "b.ts",
        signals: [
          {
            severity: "high",
            title: "still works",
          },
        ],
      } as never);

    const result = await runReview({
      files: [createFile("a.ts"), createFile("b.ts")],
      llmClient: {},
      contextText: "ctx",
      config: createConfig(),
      eventBus: new TestEventBus(),
    });

    expect(result.allSignals).toHaveLength(1);

    expect(result.allSignals[0]).toMatchObject({
      title: "still works",
    });
  });

  it("returns empty results for empty file list", async () => {
    const result = await runReview({
      files: [],
      llmClient: {},
      contextText: "ctx",
      config: createConfig(),
      eventBus: new TestEventBus(),
    });

    expect(result.allSignals).toEqual([]);

    expect(result.totalUsage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });

    expect(mockedRunFileReview).not.toHaveBeenCalled();
  });

  it("emits concurrency configured event", async () => {
    mockedRunFileReview.mockResolvedValue({
      outcome: "success",
      file: "a.ts",
      signals: [],
    } as never);

    const eventBus = new TestEventBus();

    await runReview({
      files: [createFile("a.ts")],
      llmClient: {},
      contextText: "ctx",
      config: createConfig(),
      eventBus,
    });

    const event = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowReviewConcurrencyConfigured,
    );

    expect(event).toBeDefined();

    expect(event?.fields).toMatchObject({
      files: 1,
    });
  });

  it("runs reviews concurrently", async () => {
    mockedRunFileReview.mockImplementation(async ({ file }: any) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        outcome: "success",
        file: file.path,
        signals: [],
      };
    });

    const start = Date.now();

    await runReview({
      files: [
        createFile("a.ts"),
        createFile("b.ts"),
        createFile("c.ts"),
        createFile("d.ts"),
      ],
      llmClient: {},
      contextText: "ctx",
      config: createConfig({
        review: {
          concurrency: 4,
        },
      }),
      eventBus: new TestEventBus(),
    });

    const duration = Date.now() - start;

    expect(duration).toBeLessThan(250);
  });

  it("passes metadata through to file review", async () => {
    mockedRunFileReview.mockResolvedValue({
      outcome: "success",
      file: "a.ts",
      signals: [],
    } as never);

    const metadata = {
      title: "Add concurrency",
      branchName: "feat/concurrent-review-engine",
    };

    await runReview({
      files: [createFile("a.ts")],
      llmClient: {},
      contextText: "ctx",
      metadata,
      config: createConfig(),
      eventBus: new TestEventBus(),
    });

    expect(mockedRunFileReview).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata,
      }),
    );
  });
});
