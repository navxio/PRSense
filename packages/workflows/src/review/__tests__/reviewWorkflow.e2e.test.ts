// packages/workflows/src/review/__tests__/reviewWorkflow.e2e.test.ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import { CoreEvents, type EventBus } from "@prsense/core";
import { buildResolvedConfig, RuntimeConfigSchema } from "@prsense/config";

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

    const result = await runReviewWorkflow({
      repository: {} as any, // unused — contextProviders is injected
      metadataRepository: {} as any, // unused — contextProviders is injected
      config: buildCliConfig() as any,
      credentials: {},
      diffProvider,
      eventBus,
      llmClient,
      contextProviders: [new MockContextProvider()],
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

    const result = await runReviewWorkflow({
      repository: {} as any,
      metadataRepository: {} as any,
      config: buildCliConfig() as any,
      credentials: {},
      diffProvider,
      eventBus: new TestEventBus(),
      llmClient,
      contextProviders: [new MockContextProvider()],
    });

    expect(result.outcome).toBe("success");
    expect(result.payload.signals).toHaveLength(1);
    expect(result.payload.signals[0]?.message).toBe("High-confidence finding");
    expect(result.payload.signals.map((s) => s.message)).not.toContain(
      "Low-confidence finding",
    );
    expect(llmClient.calls).toHaveLength(2); // LLM saw both files
    expect(result.payload.totalBeforeCap).toBe(1); // post-confidence-filter count
  });
});
