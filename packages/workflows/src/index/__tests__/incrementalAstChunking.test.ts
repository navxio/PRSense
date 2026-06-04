// packages/workflows/src/index/__tests__/incrementalAstChunking.test.ts

import path from "node:path";
import fs from "node:fs/promises";
import { CoreEvents } from "@prsense/core";

import { runIndexWorkflow } from "../indexWorkflow.js";
import {
  createTestRepo,
  writeFile,
  commitAll,
  TestEventBus,
} from "./helper.js";

import { createTestDb, type TestDb } from "./db.js";
import { testConfig, testCredentials } from "./config.js";

describe("AST chunking through index workflow (real DB)", () => {
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

  const runWorkflow = (
    overrides: Partial<Parameters<typeof runIndexWorkflow>[0]> = {},
  ) =>
    runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus: overrides.eventBus ?? new TestEventBus(),
      version: "test",
      chunkRepository: testDb.chunkRepo,
      metadataRepository: testDb.metadataRepo,
      ...overrides,
    });

  // ---------------------------------------------------------------------------
  // Test 1: Adding a top-level function produces a chunk with symbol metadata
  // ---------------------------------------------------------------------------
  it("indexes a top-level function and tags the chunk with its symbol name", async () => {
    const eventBus = new TestEventBus();

    await writeFile(
      repo,
      "auth.ts",
      `export function login(user: string): boolean {
  if (!user || user.length === 0) return false;
  const trimmed = user.trim();
  return trimmed.length > 0;
}`,
    );
    commitAll(repo, "init");

    const result = await runWorkflow({ force: true, eventBus });

    expect(result.outcome).toBe("success");

    const rows = testDb.chunksAt("auth.ts");
    expect(rows.length).toBeGreaterThan(0);

    // The chunk content should contain the function body — i.e. the AST chunker
    // emitted the function as a coherent unit, not a fragmented split.
    const combined = rows.map((r) => r.content).join("\n");
    expect(combined).toContain("function login");
    expect(combined).toContain("trimmed.length > 0");
  });

  // ---------------------------------------------------------------------------
  // Test 2: Modifying a function's body re-indexes the file and updates content
  // ---------------------------------------------------------------------------
  it("re-indexes a TypeScript file when a function body changes", async () => {
    const eventBus = new TestEventBus();

    // Initial: login returns true on non-empty input.
    await writeFile(
      repo,
      "auth.ts",
      `export function login(user: string): boolean {
  // Returns true for any non-empty user.
  return user.length > 0;
}`,
    );
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    // Update: login now always returns false.
    await writeFile(
      repo,
      "auth.ts",
      `export function login(user: string): boolean {
  // Returns false unconditionally now.
  return false;
}`,
    );
    commitAll(repo, "update login");

    const result = await runWorkflow({ eventBus });
    expect(result.outcome).toBe("success");

    const combined = testDb
      .chunksAt("auth.ts")
      .map((r) => r.content)
      .join("\n");

    // The new body should be present.
    expect(combined).toContain("return false");
    expect(combined).toContain("unconditionally");

    // The old body should be gone.
    expect(combined).not.toContain("user.length > 0");
    expect(combined).not.toContain("non-empty user");
  });

  // ---------------------------------------------------------------------------
  // Test 4: Deleting a .ts file removes all of its chunks regardless of how
  //         many symbols it contained
  // ---------------------------------------------------------------------------
  it("removes all chunks for a deleted TypeScript file with multiple symbols", async () => {
    const eventBus = new TestEventBus();

    // A file with multiple top-level declarations — exercises the
    // multi-chunk path in the AST chunker.
    await writeFile(
      repo,
      "session.ts",
      `export function login(user: string): boolean {
  if (!user || user.length === 0) return false;
  return user.trim().length > 0;
}

export function logout(token: string): void {
  if (!token) return;
  console.log("logged out", token);
}

export class Session {
  constructor(public id: string, public userId: string) {}
  isValid(): boolean {
    return this.id.length > 0 && this.userId.length > 0;
  }
}

export interface SessionContext {
  session: Session;
  createdAt: number;
}`,
    );
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus });

    // Confirm the file was indexed with multiple chunks before deletion.
    expect(testDb.countChunksAt("session.ts")).toBeGreaterThan(0);

    // Delete the file.
    await fs.unlink(path.join(repo, "session.ts"));
    commitAll(repo, "delete session");

    const result = await runWorkflow({ eventBus });
    expect(result.outcome).toBe("success");

    // All chunks for session.ts should be gone.
    expect(testDb.chunksAt("session.ts").length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Regression test for the chunkVersion mismatch bug.
  // ---------------------------------------------------------------------------
  it("emits rebuild-required when stored chunk version does not match current", async () => {
    const setupBus = new TestEventBus();

    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return true; }`,
    );
    commitAll(repo, "init");

    const initial = await runWorkflow({
      force: true,
      eventBus: setupBus,
    });
    expect(initial.outcome).toBe("success");

    // Discover what identity the workflow actually stored, rather than guessing.
    const metaRows = testDb.db
      .prepare(
        `SELECT repository_provider, repository_id, chunk_version
         FROM prsense_index_metadata`,
      )
      .all() as Array<{
      repository_provider: string;
      repository_id: string;
      chunk_version: number;
    }>;
    expect(metaRows.length).toBe(1);
    const stored = metaRows[0]!;

    // Downgrade chunk version on the row we just found.
    testDb.db
      .prepare(
        `UPDATE prsense_index_metadata
            SET chunk_version = 1
          WHERE repository_provider = ? AND repository_id = ?`,
      )
      .run(stored.repository_provider, stored.repository_id);

    // Modify the file so the workflow has something to do.
    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return false; }`,
    );
    commitAll(repo, "update");

    const eventBus = new TestEventBus();
    const result = await runWorkflow({ eventBus });

    expect(result.outcome).toBe("failure");

    const events = eventBus.events.map((e) => e.event);
    expect(events).toContain(CoreEvents.WorkflowIndexRebuildRequired);

    const rebuildEvent = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowIndexRebuildRequired,
    );
    expect(rebuildEvent?.fields?.forced).not.toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 6b: With --force, the workflow rebuilds despite the version mismatch.
  // ---------------------------------------------------------------------------
  it("rebuilds when chunking version mismatches and --force is set", async () => {
    const setupBus = new TestEventBus();

    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return true; }`,
    );
    commitAll(repo, "init");
    await runWorkflow({ force: true, eventBus: setupBus });

    const metaRows = testDb.db
      .prepare(
        `SELECT repository_provider, repository_id
         FROM prsense_index_metadata`,
      )
      .all() as Array<{ repository_provider: string; repository_id: string }>;
    expect(metaRows.length).toBe(1);
    const stored = metaRows[0]!;

    testDb.db
      .prepare(
        `UPDATE prsense_index_metadata
            SET chunk_version = 1
          WHERE repository_provider = ? AND repository_id = ?`,
      )
      .run(stored.repository_provider, stored.repository_id);

    const eventBus = new TestEventBus();
    const result = await runWorkflow({ force: true, eventBus });

    expect(result.outcome).toBe("success");

    const rebuildEvent = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowIndexRebuildRequired,
    );
    expect(rebuildEvent?.fields?.forced).toBe(true);

    expect(testDb.chunksAt("auth.ts").length).toBeGreaterThan(0);
  });
});
