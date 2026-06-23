// packages/workflows/src/review/__tests__/contextExclusion.test.ts
import fs from "node:fs/promises";
import type { DiffFile, UnifiedDiff } from "@prsense/core";
import { RagContextProvider } from "@prsense/context";
import {
  createOpenAiEmbeddingClient,
  createOllamaEmbeddingClient,
} from "@prsense/llm";
import { runIndexWorkflow } from "../../index/indexWorkflow.js";
import { resolveRepositorySource } from "../../index/util.js";
import {
  createTestRepo,
  writeFile,
  commitAll,
  TestEventBus,
} from "../../index/__tests__/helper.js";
import { createTestDb, type TestDb } from "../../index/__tests__/db.js";
import { testConfig, testCredentials } from "../../index/__tests__/config.js";

describe("RagContextProvider excludes diff-modified files from retrieval", () => {
  let repo: string;
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = createTestDb();
    repo = await createTestRepo();
  });

  afterEach(async () => {
    testDb.close();
    if (repo) {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  const indexRepo = () =>
    runIndexWorkflow({
      target: { provider: "filesystem", root: repo },
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: new TestEventBus(),
      version: "test",
      chunkRepository: testDb.chunkRepo,
      metadataRepository: testDb.metadataRepo,
    });

  const makeProvider = () => {
    const config = testConfig();
    const embedClient =
      config.embeddings.provider === "openai"
        ? createOpenAiEmbeddingClient({
            apiKey: process.env.PRSENSE_OPENAI_API_KEY!,
            model: config.embeddings.model,
          })
        : createOllamaEmbeddingClient({ model: config.embeddings.model });

    return new RagContextProvider({
      chunks: testDb.chunkRepo,
      metadata: testDb.metadataRepo,
      embedClient,
      embedding: {
        provider: config.embeddings.provider,
        model: config.embeddings.model,
      },
      maxChunks: 10,
    });
  };

  const makeDiffFile = (path: string): DiffFile => ({
    path,
    patch: `--- a/${path}\n+++ b/${path}\n@@ -1,1 +1,1 @@\n-old\n+new`,
    hunks: [
      {
        startLine: 1,
        endLine: 1,
        content: "+const authenticate = (user) => user.length > 0;",
      },
    ],
  });

  it("does not retrieve chunks from files in the diff", async () => {
    await writeFile(
      repo,
      "auth.ts",
      "export function authenticate(user: string) { return user.length > 0; }",
    );
    await writeFile(
      repo,
      "billing.ts",
      "export function authenticate(user: string) { return user.length > 0; }",
    );
    commitAll(repo, "init");

    await indexRepo();

    const source = resolveRepositorySource(
      { provider: "filesystem", root: repo },
      testCredentials(),
    );
    const identity = source.getRepositoryIdentity();
    const revision = (await source.getRevision()).commitSha;

    const provider = makeProvider();
    const eventBus = new TestEventBus();

    const available = await provider.isAvailable({
      repositoryIdentity: identity,
      revision,
      eventBus,
    });
    expect(available).toBe(true);

    const authFile = makeDiffFile("auth.ts");
    const diff: UnifiedDiff = { files: [authFile] };

    const chunks = await provider.getContextForFile({
      file: authFile,
      diff,
      repositoryIdentity: identity,
      revision,
      eventBus,
    });

    const retrievedPaths = chunks.map((c) => c.metadata?.path);

    expect(retrievedPaths.length).toBeGreaterThan(0);
    expect(retrievedPaths).not.toContain("auth.ts");
    expect(retrievedPaths).toContain("billing.ts");
  });
});
