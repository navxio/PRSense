// packages/workflows/src/review/__tests__/contextExclusion.test.ts

import fs from "node:fs/promises";
import { runIndexWorkflow } from "../../index/indexWorkflow.js";
import { retrieveContext } from "../retrieveContext.js";
import { resolveRepositorySource } from "../../index/util.js";
import {
  createTestRepo,
  writeFile,
  commitAll,
  TestEventBus,
} from "../../index/__tests__/helper.js";
import { initTestDb, resetTestDb } from "../../index/__tests__/db.js";
import { testConfig, testCredentials } from "../../index/__tests__/config.js";

describe("RAG retrieval excludes diff-modified files (option A)", () => {
  let repo: string;

  beforeAll(async () => {
    await initTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    repo = await createTestRepo();
  });

  afterEach(async () => {
    if (repo) {
      await fs.rm(repo, { recursive: true, force: true });
    }
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

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: new TestEventBus(),
      version: "test",
    });

    // Use the same identity the indexer wrote with
    const identity = resolveRepositorySource(repo).getRepositoryIdentity();

    const retrieved = await retrieveContext({
      config: testConfig(),
      query: "function authenticate user",
      repoProvider: identity.provider,
      repoName: identity.id,
      limit: 10,
      excludePaths: ["auth.ts"],
    });

    const retrievedPaths = retrieved.chunks.map((c) => c.metadata?.path);

    expect(retrievedPaths.length).toBeGreaterThan(0);
    expect(retrievedPaths).not.toContain("auth.ts");
    expect(retrievedPaths).toContain("billing.ts");
  });

  it("returns chunks normally when excludePaths is omitted", async () => {
    await writeFile(repo, "auth.ts", "export function authenticate() {}");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: new TestEventBus(),
      version: "test",
    });

    const identity = resolveRepositorySource(repo).getRepositoryIdentity();

    const retrieved = await retrieveContext({
      config: testConfig(),
      query: "authenticate",
      repoProvider: identity.provider,
      repoName: identity.id,
      limit: 10,
    });

    const retrievedPaths = retrieved.chunks.map((c) => c.metadata?.path);
    expect(retrievedPaths).toContain("auth.ts");
  });
});
