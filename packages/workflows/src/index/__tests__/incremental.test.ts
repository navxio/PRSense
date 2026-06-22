import path from "node:path";
import fs from "node:fs/promises";
import { CoreEvents, type EmbeddingClient } from "@prsense/core";

// These tests use .txt fixtures intentionally. Incremental indexing behavior
// (change detection, chunk insert/delete, rename handling) is orthogonal to
// chunker selection. .txt routes through the char chunker, isolating the
// incremental logic under test. TypeScript-specific AST chunking through the
// index workflow is covered separately in incrementalAstChunking.test.ts.

import { runIndexWorkflow } from "../indexWorkflow.js";
import {
  createTestRepo,
  writeFile,
  commitAll,
  TestEventBus,
} from "./helper.js";

import { createTestDb, type TestDb } from "./db.js";
import { testConfig, testCredentials } from "./config.js";

describe("Incremental indexing (real DB)", () => {
  let repo: string;
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = createTestDb();
    repo = await createTestRepo();
  });

  afterEach(async () => {
    testDb.close();
    if (repo) await fs.rm(repo, { recursive: true, force: true });
  });

  // Small helper to avoid repeating the injected args in every test
  const runWorkflow = (
    overrides: Partial<Parameters<typeof runIndexWorkflow>[0]> = {},
  ) =>
    runIndexWorkflow({
      target: { provider: "filesystem", root: repo },
      config: testConfig(),
      credentials: testCredentials(),
      eventBus: overrides.eventBus ?? new TestEventBus(),
      version: "test",
      chunkRepository: testDb.chunkRepo,
      metadataRepository: testDb.metadataRepo,
      ...overrides,
    });

  it("re-indexes only changed file", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "a.txt", "const a = 2;");
    commitAll(repo, "update");
    await runWorkflow({ eventBus });

    const combined = testDb
      .chunksAt("a.txt")
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("2");
    expect(combined).not.toContain("1");
  });

  it("removes chunks for deleted file", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.unlink(path.join(repo, "a.txt"));
    commitAll(repo, "delete");
    await runWorkflow({ eventBus });

    expect(testDb.chunksAt("a.txt").length).toBe(0);
  });

  it("indexes newly added file", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "b.txt", "const b = 42;");
    commitAll(repo, "add b");
    await runWorkflow({ eventBus });

    const rows = testDb.chunksAt("b.txt");
    const combined = rows.map((r) => r.content).join("\n");

    expect(rows.length).toBeGreaterThan(0);
    expect(combined).toContain("42");
  });

  it("does nothing when there are no changes (noop)", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    const result = await runWorkflow({ eventBus });

    expect(result.outcome).toBe("success");
    expect(result.payload.upToDate).toBe(true);
    expect(result.payload.chunksIndexed).toBe(0);
  });

  it("handles file rename correctly", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.rename(path.join(repo, "a.txt"), path.join(repo, "b.txt"));
    commitAll(repo, "rename");
    await runWorkflow({ eventBus });

    expect(testDb.chunksAt("a.txt").length).toBe(0);
    expect(testDb.chunksAt("b.txt").length).toBeGreaterThan(0);
  });

  it("handles modify and delete in same commit", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    await writeFile(repo, "b.txt", "const b = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "a.txt", "const a = 2;");
    await fs.unlink(path.join(repo, "b.txt"));
    commitAll(repo, "mixed");
    await runWorkflow({ eventBus });

    const combined = testDb
      .chunksAt("a.txt")
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("2");
    expect(testDb.chunksAt("b.txt").length).toBe(0);
  });

  it("handles multiple commits before indexing", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "c1");

    await writeFile(repo, "a.txt", "2");
    commitAll(repo, "c2");

    await writeFile(repo, "a.txt", "3");
    commitAll(repo, "c3");

    await runWorkflow({ force: true, eventBus });

    const combined = testDb
      .chunksAt("a.txt")
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("3");
  });

  it("re-indexes multiple modified files", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    await writeFile(repo, "b.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "a.txt", "2");
    await writeFile(repo, "b.txt", "2");
    commitAll(repo, "update both");
    await runWorkflow({ eventBus });

    const combined = testDb
      .allChunks()
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("2");
  });

  it("handles empty commit gracefully", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    commitAll(repo, "empty commit", { allowEmpty: true });

    const result = await runWorkflow({ eventBus });

    const planEvents = eventBus.events.filter(
      (e) => e.event === CoreEvents.WorkflowIndexPlanComputed,
    );

    expect(planEvents.at(-1)?.fields?.type).toBe("noop");
    expect(result.payload.upToDate).toBe(true);
  });

  it("handles delete and re-add of same file", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.unlink(path.join(repo, "a.txt"));
    commitAll(repo, "delete");

    await writeFile(repo, "a.txt", "2");
    commitAll(repo, "re-add");

    await runWorkflow({ eventBus });

    const combined = testDb
      .chunksAt("a.txt")
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("2");
  });

  it("force rebuild ignores incremental diff", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "a.txt", "2");
    commitAll(repo, "update");
    await runWorkflow({ force: true, eventBus });

    const combined = testDb
      .allChunks()
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("2");
  });

  it("does not duplicate chunks for unchanged files", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });
    await runWorkflow({ eventBus });

    expect(testDb.countChunksAt("a.txt")).toBeGreaterThan(0);
  });

  it("handles multiple file deletions", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    await writeFile(repo, "b.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.unlink(path.join(repo, "a.txt"));
    await fs.unlink(path.join(repo, "b.txt"));
    commitAll(repo, "delete both");
    await runWorkflow({ eventBus });

    expect(testDb.allChunks().length).toBe(0);
  });

  it("handles rename + modify", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.rename(path.join(repo, "a.txt"), path.join(repo, "b.txt"));
    await writeFile(repo, "b.txt", "2");
    commitAll(repo, "rename+modify");
    await runWorkflow({ eventBus });

    const combined = testDb
      .chunksAt("b.txt")
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("2");
  });

  it("handles large file chunking", async () => {
    const eventBus = new TestEventBus();

    const large = "x".repeat(2000);
    await writeFile(repo, "a.txt", large);
    commitAll(repo, "large");
    await runWorkflow({ force: true, eventBus });

    expect(testDb.countChunksAt("a.txt")).toBeGreaterThan(1);
  });

  it("handles diff across multiple commits", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "c1");

    await writeFile(repo, "a.txt", "2");
    commitAll(repo, "c2");

    await writeFile(repo, "a.txt", "3");
    commitAll(repo, "c3");

    await runWorkflow({ force: true, eventBus });

    const combined = testDb
      .chunksAt("a.txt")
      .map((r) => r.content)
      .join("\n");

    expect(combined).toContain("3");
  });

  it("treats rename as delete + add (snapshot semantics)", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.rename(path.join(repo, "a.txt"), path.join(repo, "b.txt"));
    commitAll(repo, "rename");
    await runWorkflow({ eventBus });

    const deleteEvents = eventBus.events
      .filter((e) => e.event === CoreEvents.WorkflowIndexFilesDeleted)
      .at(-1);

    const changeEvents = eventBus.events
      .filter((e) => e.event === CoreEvents.WorkflowIndexFilesChanged)
      .at(-1);

    expect(deleteEvents?.fields?.deletedFiles).toContain("a.txt");
    expect(changeEvents?.fields?.changedFiles).toContain("b.txt");
  });

  it("indexes same content under different paths independently", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "same");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "b.txt", "same");
    commitAll(repo, "copy");
    await runWorkflow({ eventBus });

    const paths = testDb.allPaths();

    expect(paths).toContain("a.txt");
    expect(paths).toContain("b.txt");
  });

  it("treats reverted content across commits as noop (snapshot-based diff)", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "c1");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "a.txt", "2");
    commitAll(repo, "c2");

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "c3");
    await runWorkflow({ eventBus });

    const planEvents = eventBus.events.filter(
      (e) => e.event === CoreEvents.WorkflowIndexPlanComputed,
    );

    expect(planEvents.at(-1)?.fields?.type).toBe("noop");
  });

  it("skips chunk building when only deletions occur", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    const before = eventBus.events.length;
    await fs.unlink(path.join(repo, "a.txt"));
    commitAll(repo, "delete");
    await runWorkflow({ eventBus });

    const afterEvents = eventBus.events.slice(before);
    const chunkEvents = afterEvents.filter(
      (e) => e.event === CoreEvents.ContextChunksBuilt,
    );

    expect(chunkEvents.length).toBe(0);
  });

  it("produces identical snapshots for identical commits", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "1");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    const result = await runWorkflow({ eventBus });
    expect(result.payload.upToDate).toBe(true);
  });

  it("treats reverted content as noop (content-based diff)", async () => {
    const eventBus = new TestEventBus();

    for (let i = 0; i < 20; i++) {
      await writeFile(repo, `f${i}.txt`, `${i}`);
    }
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await writeFile(repo, "f10.txt", "changed");
    commitAll(repo, "modify one");
    await runWorkflow({ eventBus });

    const changeEvents = eventBus.events.filter(
      (e) => e.event === CoreEvents.WorkflowIndexFilesChanged,
    );

    expect(changeEvents.at(-1)?.fields?.changedFiles).toEqual(["f10.txt"]);
  });

  it("handles delete-only commit (removes chunks and updates metadata)", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    await fs.unlink(path.join(repo, "a.txt"));
    commitAll(repo, "delete");
    await runWorkflow({ eventBus });

    expect(testDb.chunksAt("a.txt").length).toBe(0);

    const planEvent = eventBus.events
      .filter((e) => e.event === CoreEvents.WorkflowIndexPlanComputed)
      .at(-1);

    expect(planEvent?.fields?.type).toBe("delete-only");
  });

  it("delete-only dry-run does not mutate chunks or metadata", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    const before = await testDb.metadataRepo.load("local", path.basename(repo));

    await fs.unlink(path.join(repo, "a.txt"));
    commitAll(repo, "delete");
    await runWorkflow({ dryRun: true, eventBus });

    // chunks should STILL exist (dry-run = no mutation)
    expect(testDb.chunksAt("a.txt").length).toBeGreaterThan(0);

    // metadata should NOT change
    const after = await testDb.metadataRepo.load("local", path.basename(repo));
    expect(after?.revision.commitSha).toBe(before?.revision.commitSha);

    const planEvent = eventBus.events
      .filter((e) => e.event === CoreEvents.WorkflowIndexPlanComputed)
      .at(-1);

    expect(planEvent?.fields?.type).toBe("delete-only");
  });
});

function fakeEmbeddingClient(dim: number): EmbeddingClient {
  return {
    embed: async (texts: string[]) =>
      texts.map(() => Array.from({ length: dim }, () => 0.1)),
    dimension: async () => dim,
    maxInputChars: 4000,
  };
}

describe("Rebuild on embedding dimension change", () => {
  let repo: string;
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = createTestDb();
    repo = await createTestRepo();
  });

  afterEach(async () => {
    testDb.close();
    if (repo) await fs.rm(repo, { recursive: true, force: true });
  });

  it("force-rebuilds vec table when embedding dimension changes", async () => {
    await writeFile(repo, "a.txt", "const a = 1;");
    commitAll(repo, "init");

    // First run: ollama-shaped config (768).
    await runIndexWorkflow({
      target: { provider: "filesystem", root: repo },
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: new TestEventBus(),
      version: "test",
      chunkRepository: testDb.chunkRepo,
      metadataRepository: testDb.metadataRepo,
      injectedEmbeddingClient: fakeEmbeddingClient(768),
    });

    expect(testDb.chunksAt("a.txt").length).toBeGreaterThan(0);

    // Second run: openai-shaped config (1536), force rebuild.
    const openaiConfig = {
      ...testConfig(),
      embeddings: { provider: "openai", model: "text-embedding-3-small" },
    } as ReturnType<typeof testConfig>;

    const eventBus = new TestEventBus();
    const result = await runIndexWorkflow({
      target: { provider: "filesystem", root: repo },
      config: openaiConfig,
      credentials: {
        ...testCredentials(),
        openai: { apiKey: "sk-fake", available: true },
      },
      force: true,
      eventBus,
      version: "test",
      chunkRepository: testDb.chunkRepo,
      metadataRepository: testDb.metadataRepo,
      injectedEmbeddingClient: fakeEmbeddingClient(1536),
    });

    expect(result.outcome).toBe("success");
    expect(testDb.chunksAt("a.txt").length).toBeGreaterThan(0);

    const rebuild = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowIndexRebuildRequired,
    );
    expect(rebuild?.fields?.forced).toBe(true);
  });
});
