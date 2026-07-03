// packages/workflows/src/review/__tests__/reviewWorkflow.e2e.test.ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import { CoreEvents, type EventBus } from "@prsense/core";
import { buildResolvedConfig, RuntimeConfigSchema } from "@prsense/config";
import { DiffProvider } from "@prsense/core";
import { LlmClient } from "@prsense/llm";
import { ResolvedConfig } from "@prsense/config";
import { ContextProvider } from "@prsense/core";

import { runReviewWorkflow } from "../reviewWorkflow.js";
import {
  MockDiffProvider,
  MockContextProvider,
  MockLlmClient,
  makeDiffFile,
  makeSignal,
  llmResponseFromSignals,
  byFilePath,
  resetSignalCounter,
} from "./mocks.js";

class ThrowingDiffProvider implements DiffProvider {
  constructor(private err = new Error("diff load failed: 500 from remote")) {}
  async load(): Promise<never> {
    throw this.err;
  }
}

class TestEventBus implements EventBus {
  events: Array<{ event: string; fields?: unknown }> = [];
  emit(event: string, fields?: unknown) {
    this.events.push({ event, fields });
  }
}

function buildCliConfig() {
  const runtime = RuntimeConfigSchema.parse({}) as any;
  return buildResolvedConfig(runtime, "cli", {
    root: "/tmp/test-repo",
    provider: "filesystem",
  });
}

async function runE2EReview(opts: {
  diffProvider: DiffProvider;
  llmClient: LlmClient;
  contextProviders?: ContextProvider[];
  eventBus?: TestEventBus;
  config?: ResolvedConfig;
}) {
  const eventBus = opts.eventBus ?? new TestEventBus();
  const result = await runReviewWorkflow({
    repository: {} as any,
    metadataRepository: {} as any,
    config: (opts.config ?? buildCliConfig()) as any,
    credentials: {},
    diffProvider: opts.diffProvider,
    eventBus,
    llmClient: opts.llmClient,
    contextProviders: opts.contextProviders ?? [new MockContextProvider()],
  });
  return { result, eventBus };
}

describe("runReviewWorkflow E2E", () => {
  beforeEach(() => resetSignalCounter());

  it("returns signals from a two-file diff through the full pipeline", async () => {
    const fileA = makeDiffFile("src/auth.ts");
    const fileB = makeDiffFile("src/billing.ts");

    const signalA = makeSignal({
      file: "src/auth.ts",
      message: "Missing input validation",
      severity: "high",
      confidence: 0.95,
    });
    const signalB = makeSignal({
      file: "src/billing.ts",
      message: "Currency rounding error",
      severity: "medium",
      confidence: 0.9,
    });

    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA, fileB] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
      metadata: { title: "Add validation and fix rounding" },
    });

    const llmClient = new MockLlmClient(
      byFilePath({
        "src/auth.ts": llmResponseFromSignals([signalA], {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        }),
        "src/billing.ts": llmResponseFromSignals([signalB], {
          promptTokens: 80,
          completionTokens: 40,
          totalTokens: 120,
        }),
      }),
    );

    const eventBus = new TestEventBus();

    const { result } = await runE2EReview({
      eventBus,
      diffProvider,
      llmClient,
    });

    // Outcome
    expect(result.outcome).toBe("success");

    // Signals make it through the pipeline
    expect(result.payload.signals).toHaveLength(2);
    const messages = result.payload.signals.map((s) => s.message);
    expect(messages).toContain("Missing input validation");
    expect(messages).toContain("Currency rounding error");

    // Nothing trimmed by confidence filter or topN cap
    expect(result.payload.totalBeforeCap).toBe(2);

    // Usage aggregated across files
    expect(result.payload.usage).toEqual({
      promptTokens: 180,
      completionTokens: 90,
      totalTokens: 270,
    });

    // Diff summary populated
    expect(result.payload.diffSummary?.files).toEqual(
      expect.arrayContaining(["src/auth.ts", "src/billing.ts"]),
    );

    // LLM called once per file
    expect(llmClient.calls).toHaveLength(2);

    // Key phase events fired
    const events = eventBus.events.map((e) => e.event);
    expect(events).toContain(CoreEvents.WorkflowReviewStarted);
    expect(events).toContain(CoreEvents.WorkflowReviewDiffLoaded);
    expect(events).toContain(CoreEvents.WorkflowReviewFinished);
    expect(events).not.toContain(CoreEvents.WorkflowReviewFailed);
  });

  it("filters out signals below the confidence threshold", async () => {
    const fileA = makeDiffFile("src/auth.ts");
    const fileB = makeDiffFile("src/billing.ts");

    const keptSignal = makeSignal({
      file: "src/auth.ts",
      message: "High-confidence finding",
      confidence: 0.95, // above default 0.8
    });
    const droppedSignal = makeSignal({
      file: "src/billing.ts",
      message: "Low-confidence finding",
      confidence: 0.5, // below threshold
    });

    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA, fileB] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });

    const llmClient = new MockLlmClient(
      byFilePath({
        "src/auth.ts": llmResponseFromSignals([keptSignal]),
        "src/billing.ts": llmResponseFromSignals([droppedSignal]),
      }),
    );

    const { result } = await runE2EReview({ diffProvider, llmClient });

    expect(result.outcome).toBe("success");
    expect(result.payload.signals).toHaveLength(1);
    expect(result.payload.signals[0]?.message).toBe("High-confidence finding");
    expect(result.payload.signals.map((s) => s.message)).not.toContain(
      "Low-confidence finding",
    );
    expect(llmClient.calls).toHaveLength(2); // LLM saw both files
    expect(result.payload.totalBeforeCap).toBe(1); // post-confidence-filter count
  });

  it("trims excess signals via the topN cap, keeping highest-severity", async () => {
    const fileA = makeDiffFile("src/auth.ts");
    const fileB = makeDiffFile("src/billing.ts");

    const high1 = makeSignal({
      file: "src/auth.ts",
      message: "high-1",
      severity: "high",
      confidence: 0.9,
    });
    const high2 = makeSignal({
      file: "src/auth.ts",
      message: "high-2",
      severity: "high",
      confidence: 0.9,
    });
    const high3 = makeSignal({
      file: "src/billing.ts",
      message: "high-3",
      severity: "high",
      confidence: 0.9,
    });
    const lowDropped = makeSignal({
      file: "src/billing.ts",
      message: "low-dropped",
      severity: "low",
      confidence: 0.9,
    });

    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA, fileB] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });

    const llmClient = new MockLlmClient(
      byFilePath({
        "src/auth.ts": llmResponseFromSignals([high1, high2]),
        "src/billing.ts": llmResponseFromSignals([high3, lowDropped]),
      }),
    );

    const { result } = await runE2EReview({ llmClient, diffProvider });

    expect(result.outcome).toBe("success");
    expect(result.payload.signals).toHaveLength(3); // default topSignals = 3
    expect(result.payload.totalBeforeCap).toBe(4);
    expect(result.payload.signals.map((s) => s.message)).not.toContain(
      "low-dropped",
    );
  });

  it("short-circuits on empty diff without calling the LLM or context provider", async () => {
    const diffProvider = new MockDiffProvider({
      diff: { files: [] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });

    const llmClient = new MockLlmClient(() => {
      throw new Error("LLM should not be called for empty diff");
    });

    const contextProvider = new MockContextProvider();
    const isAvailableSpy = jest.spyOn(contextProvider, "isAvailable");

    const { result } = await runE2EReview({
      contextProviders: [contextProvider],
      llmClient,
      diffProvider,
    });

    expect(result.outcome).toBe("success");
    expect(result.payload.signals).toEqual([]);
    expect(llmClient.calls).toHaveLength(0);
    expect(isAvailableSpy).not.toHaveBeenCalled();
  });

  it("isolates LLM failures per file — other files still produce signals", async () => {
    const fileA = makeDiffFile("src/auth.ts");
    const fileB = makeDiffFile("src/billing.ts");

    const survivingSignal = makeSignal({
      file: "src/billing.ts",
      message: "Survives the partial failure",
      confidence: 0.9,
    });

    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA, fileB] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });

    const llmClient = new MockLlmClient((req) => {
      if (req.prompt.user.includes("src/auth.ts")) {
        throw new Error("simulated LLM outage for auth.ts");
      }
      return llmResponseFromSignals([survivingSignal]);
    });

    const eventBus = new TestEventBus();

    const { result } = await runE2EReview({
      eventBus,
      llmClient,
      diffProvider,
    });

    // Workflow overall succeeds despite one file failing
    expect(result.outcome).toBe("success");

    // Surviving file's signal made it through
    expect(result.payload.signals).toHaveLength(1);
    expect(result.payload.signals[0]?.message).toBe(
      "Survives the partial failure",
    );

    // Both files were attempted
    expect(llmClient.calls).toHaveLength(2);

    // The failure was recorded as an event for the affected file
    const failureEvent = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowReviewFileReviewFailed,
    );
    expect(failureEvent).toBeDefined();
    expect((failureEvent?.fields as any)?.file).toBe("src/auth.ts");
  });

  it("runs review without context when no providers are available", async () => {
    const fileA = makeDiffFile("src/auth.ts");

    const signal = makeSignal({
      file: "src/auth.ts",
      message: "Found without context",
      confidence: 0.9,
    });

    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });

    const llmClient = new MockLlmClient(
      byFilePath({
        "src/auth.ts": llmResponseFromSignals([signal]),
      }),
    );

    const contextProvider = new MockContextProvider({ available: false });
    const getContextSpy = jest.spyOn(contextProvider, "getContextForFile");

    const eventBus = new TestEventBus();

    const { result } = await runE2EReview({
      eventBus,
      contextProviders: [contextProvider],
      llmClient,
      diffProvider,
    });
    // Review still completes and produces signals
    expect(result.outcome).toBe("success");
    expect(result.payload.signals).toHaveLength(1);
    expect(result.payload.signals[0]?.message).toBe("Found without context");

    // LLM was called — workflow didn't short-circuit
    expect(llmClient.calls).toHaveLength(1);

    // Availability gate skipped retrieval entirely
    expect(getContextSpy).not.toHaveBeenCalled();

    // Context-available event was NOT emitted
    expect(eventBus.events.map((e) => e.event)).not.toContain(
      CoreEvents.WorkflowReviewContextAvailable,
    );
  });

  it("fails the workflow when the diff cannot be loaded", async () => {
    const llmClient = new MockLlmClient(() => {
      throw new Error("LLM should not run when diff load fails");
    });
    const eventBus = new TestEventBus();

    const { result } = await runE2EReview({
      eventBus,
      diffProvider: new ThrowingDiffProvider(),
      llmClient,
    });

    expect(result.outcome).toBe("failure");
    expect(llmClient.calls).toHaveLength(0);

    const events = eventBus.events.map((e) => e.event);
    expect(events).toContain(CoreEvents.WorkflowReviewStarted);
    expect(events).toContain(CoreEvents.WorkflowReviewFailed);
    expect(events).not.toContain(CoreEvents.WorkflowReviewDiffLoaded);
    expect(events).not.toContain(CoreEvents.WorkflowReviewFinished);
  });

  it("fails the workflow when every file fails", async () => {
    const fileA = makeDiffFile("src/auth.ts");
    const fileB = makeDiffFile("src/billing.ts");
    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA, fileB] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });
    const llmClient = new MockLlmClient(() => {
      throw new Error("total LLM outage");
    });
    const eventBus = new TestEventBus();
    const { result } = await runE2EReview({
      eventBus,
      diffProvider,
      llmClient,
    });
    expect(result.outcome).toBe("failure");
    expect(result.payload.signals).toEqual([]);
    expect(llmClient.calls).toHaveLength(2);

    const failures = eventBus.events.filter(
      (e) => e.event === CoreEvents.WorkflowReviewFileReviewFailed,
    );
    expect(failures).toHaveLength(2);
    expect(eventBus.events.map((e) => e.event)).toContain(
      CoreEvents.WorkflowReviewFailed,
    );
    expect(eventBus.events.map((e) => e.event)).not.toContain(
      CoreEvents.WorkflowReviewFinished,
    );
  });

  it("degrades to context-free review when a context provider throws", async () => {
    const fileA = makeDiffFile("src/auth.ts");
    const signal = makeSignal({
      file: "src/auth.ts",
      message: "Found despite context failure",
      confidence: 0.9,
    });

    const diffProvider = new MockDiffProvider({
      diff: { files: [fileA] },
      revision: "abc123",
      repositoryIdentity: { provider: "filesystem", id: "test-repo" },
    });

    const llmClient = new MockLlmClient(
      byFilePath({ "src/auth.ts": llmResponseFromSignals([signal]) }),
    );

    const contextProvider = new MockContextProvider();
    jest
      .spyOn(contextProvider, "getContextForFile")
      .mockRejectedValue(new Error("context backend unavailable"));

    const { result } = await runE2EReview({
      contextProviders: [contextProvider],
      llmClient,
      diffProvider,
    });

    expect(result.outcome).toBe("success");
    expect(result.payload.signals).toHaveLength(1);
    expect(llmClient.calls).toHaveLength(1);
  });
});
