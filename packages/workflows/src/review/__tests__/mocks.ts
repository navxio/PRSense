// packages/workflows/src/review/__tests__/mocks.ts
import type {
  ContextProvider,
  ContextChunk,
  DiffFile,
  DiffProvider,
  RepositoryIdentity,
  ReviewSignal,
  UnifiedDiff,
} from "@prsense/core";
import type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmUsage,
} from "@prsense/llm";

// ─── Diff ────────────────────────────────────────────────────────────────

export class MockDiffProvider implements DiffProvider {
  constructor(
    private payload: {
      diff: UnifiedDiff;
      revision: string;
      repositoryIdentity: RepositoryIdentity;
      metadata?: { title?: string; description?: string; branchName?: string };
    },
  ) {}
  async load() {
    return this.payload;
  }
}

export function makeDiffFile(
  path: string,
  overrides: Partial<DiffFile> = {},
): DiffFile {
  return {
    path,
    patch: `diff --git a/${path} b/${path}\n@@ -1 +1 @@\n-old\n+new`,
    hunks: [{ startLine: 1, endLine: 1, content: "+new" }],
    ...overrides,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────

export class MockContextProvider implements ContextProvider {
  readonly name = "mock";
  constructor(
    private opts: {
      chunksByFile?: Record<string, ContextChunk[]>;
      available?: boolean;
    } = {},
  ) {}
  async isAvailable(): Promise<boolean> {
    return this.opts.available ?? true;
  }
  async getContextForFile({
    file,
  }: {
    file: DiffFile;
  }): Promise<ContextChunk[]> {
    return this.opts.chunksByFile?.[file.path] ?? [];
  }
}

// ─── LLM ─────────────────────────────────────────────────────────────────

export class MockLlmClient implements LlmClient {
  public calls: LlmRequest[] = [];
  constructor(
    private respond: (req: LlmRequest) => LlmResponse | Promise<LlmResponse>,
  ) {}
  async generate(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    return this.respond(req);
  }
}

/** Build an LlmResponse whose text is the JSON envelope runFileReview expects. */
export function llmResponseFromSignals(
  signals: ReviewSignal[],
  usage?: LlmUsage,
): LlmResponse {
  return {
    text: JSON.stringify({ signals }),
    ...(usage ? { usage } : {}),
  };
}

/**
 * Dispatch responses by file path. Matches longest path first so
 * `src/auth.ts` wins over `auth.ts` when both are configured.
 * Throws on no-match — loud failures during test debugging.
 */
export function byFilePath(
  responses: Record<string, LlmResponse>,
): (req: LlmRequest) => LlmResponse {
  const paths = Object.keys(responses).sort((a, b) => b.length - a.length);
  return (req) => {
    for (const p of paths) {
      if (req.prompt.user.includes(p)) return responses[p]!;
    }
    throw new Error(
      `FakeLlmClient: no canned response for prompt:\n${req.prompt.user.slice(0, 200)}`,
    );
  };
}

// ─── Signals ─────────────────────────────────────────────────────────────

let signalCounter = 0;
export function resetSignalCounter() {
  signalCounter = 0;
}

export function makeSignal(
  overrides: Partial<ReviewSignal> = {},
): ReviewSignal {
  signalCounter += 1;
  return {
    id: `sig-${signalCounter}`,
    type: "bug",
    severity: "medium",
    confidence: 0.9,
    file: "test.ts",
    message: "Test signal",
    source: "llm",
    ...overrides,
  };
}
