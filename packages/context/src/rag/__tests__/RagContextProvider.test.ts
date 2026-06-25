// packages/context/src/rag/__tests__/RagContextProvider.test.ts
import { describe, it, expect, jest } from "@jest/globals";
import { CoreEvents } from "@prsense/core";
import type { EmbeddingClient, UnifiedDiff, DiffFile } from "@prsense/core";
import type { RagChunkRepository } from "../RagChunkRepository.js";
import type { IndexMetadataRepository } from "../../index/IndexMetadataRepository.js";
import { RagContextProvider } from "../../providers/RagContextProvider.js";

class TestEventBus {
  events: Array<{ event: string; fields?: unknown }> = [];
  emit(event: string, fields?: unknown) {
    this.events.push({ event, fields });
  }
}

function mockEmbedClient(
  overrides: Partial<EmbeddingClient> = {},
): EmbeddingClient {
  return {
    embed: jest.fn(
      async (_texts: string[]): Promise<number[][]> => [[0.1, 0.2, 0.3]],
    ),
    dimension: jest.fn(async (): Promise<number> => 3),
    maxInputChars: 4000,
    ...overrides,
  } as EmbeddingClient;
}

function mockChunks(
  searchResult: Array<{
    id: string;
    path: string;
    content: string;
    distance: number;
    lineStart?: number;
    lineEnd?: number;
    language?: string;
  }> = [],
): RagChunkRepository {
  return {
    searchNearest: jest.fn(async () => searchResult),
  } as unknown as RagChunkRepository;
}

function mockMetadata(
  stored: {
    embedding: { provider: string; model: string };
    revision: { commitSha: string };
  } | null = {
    embedding: { provider: "openai", model: "text-embedding-3-small" },
    revision: { commitSha: "abc123" },
  },
): IndexMetadataRepository {
  return {
    load: jest.fn(async () => stored),
  } as unknown as IndexMetadataRepository;
}

function makeProvider(
  overrides: Partial<{
    chunks: RagChunkRepository;
    metadata: IndexMetadataRepository;
    embedClient: EmbeddingClient;
    embedding: { provider: string; model: string };
    maxChunks: number;
    prMetadata: { title?: string };
  }> = {},
) {
  const deps = {
    chunks: mockChunks(),
    metadata: mockMetadata(),
    embedClient: mockEmbedClient(),
    embedding: { provider: "openai", model: "text-embedding-3-small" },
    maxChunks: 5,
    ...overrides,
  };
  return new RagContextProvider(deps);
}

function makeFile(path = "src/auth/session.ts"): DiffFile {
  return {
    path,
    patch: "diff --git a/x b/x\n+const x = 1;",
    hunks: [{ startLine: 1, endLine: 1, content: "+const x = 1;" }],
  };
}

const identity = { provider: "github" as const, id: "owner/repo" };
const emptyDiff: UnifiedDiff = { files: [] };

describe("RagContextProvider", () => {
  describe("isAvailable", () => {
    it("returns true when stored embedding matches config", async () => {
      const provider = makeProvider();
      const result = await provider.isAvailable({
        repositoryIdentity: identity,
        revision: "abc123",
        eventBus: new TestEventBus(),
        diff: emptyDiff,
      });
      expect(result).toBe(true);
    });

    it("returns false and emits unavailable event when no metadata exists", async () => {
      const eventBus = new TestEventBus();
      const provider = makeProvider({ metadata: mockMetadata(null) });
      const result = await provider.isAvailable({
        repositoryIdentity: identity,
        revision: "abc123",
        eventBus,
        diff: emptyDiff,
      });
      expect(result).toBe(false);
      expect(eventBus.events.map((e) => e.event)).toContain(
        CoreEvents.WorkflowReviewContextUnavailable,
      );
    });

    it("returns false when embedding provider mismatches", async () => {
      const provider = makeProvider({
        metadata: mockMetadata({
          embedding: { provider: "ollama", model: "nomic-embed-text" },
          revision: { commitSha: "abc123" },
        }),
        embedding: { provider: "openai", model: "text-embedding-3-small" },
      });
      const result = await provider.isAvailable({
        repositoryIdentity: identity,
        revision: "abc123",
        eventBus: new TestEventBus(),
        diff: emptyDiff,
      });
      expect(result).toBe(false);
    });

    it("returns false when embedding model mismatches", async () => {
      const provider = makeProvider({
        metadata: mockMetadata({
          embedding: { provider: "openai", model: "text-embedding-ada-002" },
          revision: { commitSha: "abc123" },
        }),
        embedding: { provider: "openai", model: "text-embedding-3-small" },
      });
      const result = await provider.isAvailable({
        repositoryIdentity: identity,
        revision: "abc123",
        eventBus: new TestEventBus(),
        diff: emptyDiff,
      });
      expect(result).toBe(false);
    });

    it("emits index-outdated when commit SHA differs but embedding matches", async () => {
      const eventBus = new TestEventBus();
      const provider = makeProvider({
        metadata: mockMetadata({
          embedding: { provider: "openai", model: "text-embedding-3-small" },
          revision: { commitSha: "old-sha" },
        }),
      });
      await provider.isAvailable({
        repositoryIdentity: identity,
        revision: "new-sha",
        eventBus,
        diff: emptyDiff,
      });
      expect(eventBus.events.map((e) => e.event)).toContain(
        CoreEvents.WorkflowReviewIndexOutdated,
      );
    });
  });

  describe("getContextForFile", () => {
    function makeInput(diffOverride?: UnifiedDiff) {
      const d = diffOverride ?? { files: [makeFile()] };
      const file = d.files[0]!;
      return {
        file,
        diff: d,
        repositoryIdentity: identity,
        revision: "abc123",
        eventBus: new TestEventBus(),
      };
    }

    it("returns chunks tagged with rag provider", async () => {
      const provider = makeProvider({
        chunks: mockChunks([
          {
            id: "chunk-1",
            path: "helpers/util.ts",
            content: "function helper() {}",
            distance: 0.1,
            lineStart: 10,
            lineEnd: 20,
            language: "typescript",
          },
        ]),
      });
      const result = await provider.getContextForFile(makeInput());
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "chunk-1",
        content: "function helper() {}",
        source: { kind: "file", path: "helpers/util.ts" },
        provider: "rag",
      });
    });

    it("calls embedClient.embed with a query under maxInputChars", async () => {
      const embed = jest.fn(
        async (_texts: string[]): Promise<number[][]> => [[0.1, 0.2, 0.3]],
      );
      const provider = makeProvider({
        embedClient: mockEmbedClient({ embed, maxInputChars: 200 }),
      });
      await provider.getContextForFile(makeInput());

      const firstCall = embed.mock.calls[0];
      expect(firstCall).toBeDefined();
      const queries = firstCall![0];
      expect(queries[0]!.length).toBeLessThanOrEqual(200);
    });

    it("passes maxChunks as the search limit", async () => {
      const searchNearest = jest.fn(async (_params: unknown) => [] as never[]);
      const provider = makeProvider({
        chunks: { searchNearest } as unknown as RagChunkRepository,
        maxChunks: 3,
      });
      await provider.getContextForFile(makeInput());
      expect(searchNearest).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 3 }),
      );
    });

    it("excludes every file in the diff from search results", async () => {
      const searchNearest = jest.fn(async (_params: unknown) => [] as never[]);
      const multiFileDiff: UnifiedDiff = {
        files: [makeFile("a.ts"), makeFile("b.ts"), makeFile("c.ts")],
      };
      const provider = makeProvider({
        chunks: { searchNearest } as unknown as RagChunkRepository,
      });
      await provider.getContextForFile(makeInput(multiFileDiff));
      expect(searchNearest).toHaveBeenCalledWith(
        expect.objectContaining({
          excludePaths: ["a.ts", "b.ts", "c.ts"],
        }),
      );
    });

    it("throws when embedding generation returns nothing", async () => {
      const provider = makeProvider({
        embedClient: mockEmbedClient({
          embed: jest.fn(async (_texts: string[]): Promise<number[][]> => []),
        }),
      });
      await expect(provider.getContextForFile(makeInput())).rejects.toThrow(
        "Failed to generate query embedding",
      );
    });

    it("forwards PR metadata title into the embedding query", async () => {
      const embed = jest.fn(
        async (_texts: string[]): Promise<number[][]> => [[0.1, 0.2, 0.3]],
      );
      const provider = makeProvider({
        embedClient: mockEmbedClient({ embed, maxInputChars: 10_000 }),
        prMetadata: { title: "Fix critical session bug" },
      });
      await provider.getContextForFile(makeInput());

      const firstCall = embed.mock.calls[0];
      expect(firstCall).toBeDefined();
      const queries = firstCall![0];
      expect(queries[0]).toContain("Fix critical session bug");
    });

    it("emits context-retrieved event with file path and chunk count", async () => {
      const eventBus = new TestEventBus();
      const provider = makeProvider({
        chunks: mockChunks([
          { id: "1", path: "a.ts", content: "a", distance: 0.1 },
          { id: "2", path: "b.ts", content: "b", distance: 0.2 },
        ]),
      });
      await provider.getContextForFile({
        ...makeInput(),
        eventBus,
      });
      const retrieved = eventBus.events.find(
        (e) => e.event === CoreEvents.WorkflowReviewContextRetrieved,
      );
      expect(retrieved).toBeDefined();
      expect(retrieved?.fields).toMatchObject({
        file: "src/auth/session.ts",
        chunks: 2,
      });
    });
  });
});
