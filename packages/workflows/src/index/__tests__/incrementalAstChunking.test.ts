// packages/workflows/src/index/__tests__/incrementalAstChunking.test.ts

import { Client } from "pg";
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

import { initTestDb, resetTestDb } from "./db.js";
import { testConfig, testCredentials } from "./config.js";

const DB_CONFIG = {
  host: "localhost",
  port: 10001,
  user: "prsense",
  password: "prsense",
  database: "prsense_test",
};

describe("AST chunking through index workflow (real DB)", () => {
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

    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    expect(result.outcome).toBe("success");

    const client = new Client(DB_CONFIG);
    await client.connect();
    const res = await client.query(
      `SELECT path, content FROM rag_chunks WHERE path = 'auth.ts'`,
    );
    await client.end();

    // At least one chunk should exist for auth.ts.
    expect(res.rows.length).toBeGreaterThan(0);

    // The chunk content should contain the function body — i.e. the AST chunker
    // emitted the function as a coherent unit, not a fragmented split.
    const combined = res.rows.map((r) => r.content).join("\n");
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

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

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

    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    expect(result.outcome).toBe("success");

    const client = new Client(DB_CONFIG);
    await client.connect();
    const res = await client.query(
      `SELECT content FROM rag_chunks WHERE path = 'auth.ts'`,
    );
    await client.end();

    const combined = res.rows.map((r) => r.content).join("\n");

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

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // Confirm the file was indexed with multiple chunks before deletion.
    const clientBefore = new Client(DB_CONFIG);
    await clientBefore.connect();
    const before = await clientBefore.query(
      `SELECT COUNT(*) FROM rag_chunks WHERE path = 'session.ts'`,
    );
    await clientBefore.end();
    expect(Number(before.rows[0].count)).toBeGreaterThan(0);

    // Delete the file.
    await fs.unlink(path.join(repo, "session.ts"));
    commitAll(repo, "delete session");

    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    expect(result.outcome).toBe("success");

    // All chunks for session.ts should be gone.
    const clientAfter = new Client(DB_CONFIG);
    await clientAfter.connect();
    const after = await clientAfter.query(
      `SELECT * FROM rag_chunks WHERE path = 'session.ts'`,
    );
    await clientAfter.end();

    expect(after.rows.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Regression test for the chunkVersion mismatch bug.
  //         If stored chunking.version doesn't match current CHUNK_VERSION,
  //         the workflow must emit WorkflowIndexRebuildRequired and fail.
  // ---------------------------------------------------------------------------
  it("emits rebuild-required when stored chunk version does not match current", async () => {
    const setupBus = new TestEventBus();

    // Index a file at the current version.
    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return true; }`,
    );
    commitAll(repo, "init");

    const initial = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: setupBus,
      version: "test",
    });

    expect(initial.outcome).toBe("success");

    // Manually downgrade the stored chunking version to simulate an
    // index built by an older PRSense.
    const client = new Client(DB_CONFIG);
    await client.connect();

    // First, confirm metadata exists for the repo (sanity check that the
    // initial index actually saved metadata).
    const repoName = path.basename(repo);
    const metaCheck = await client.query(
      `SELECT * FROM prsense_index_metadata WHERE repository_provider = 'local' AND repository_id = $1`,
      [repoName],
    );
    expect(metaCheck.rows.length).toBe(1);

    // Downgrade chunking version.
    await client.query(
      `UPDATE prsense_index_metadata
         SET chunk_version = 1
       WHERE repository_provider = 'local' AND repository_id = $1`,
      [repoName],
    );
    await client.end();

    // Modify the file so there's something to incrementally index.
    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return false; }`,
    );
    commitAll(repo, "update");

    // Run without force. Should detect incompatibility and refuse.
    const eventBus = new TestEventBus();
    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    expect(result.outcome).toBe("failure");

    const events = eventBus.events.map((e) => e.event);
    expect(events).toContain(CoreEvents.WorkflowIndexRebuildRequired);

    // The rebuild-required event should not have `forced: true` — this is
    // the user-must-rebuild path, not the auto-rebuild-on-force path.
    const rebuildEvent = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowIndexRebuildRequired,
    );
    expect(rebuildEvent?.fields?.forced).not.toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 6b: Companion to Test 6 — with --force, the workflow proceeds and
  //          rebuilds successfully despite the version mismatch.
  // ---------------------------------------------------------------------------
  it("rebuilds when chunking version mismatches and --force is set", async () => {
    const setupBus = new TestEventBus();

    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return true; }`,
    );
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: setupBus,
      version: "test",
    });

    // Downgrade stored version.
    const client = new Client(DB_CONFIG);
    await client.connect();
    const repoName = path.basename(repo);
    await client.query(
      `UPDATE prsense_index_metadata
         SET chunk_version = 1
       WHERE repository_provider = 'local' AND repository_id = $1`,
      [repoName],
    );
    await client.end();

    // Run WITH force. Should rebuild instead of failing.
    const eventBus = new TestEventBus();
    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    expect(result.outcome).toBe("success");

    // The forced rebuild path emits WorkflowIndexRebuildRequired with
    // forced: true.
    const rebuildEvent = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowIndexRebuildRequired,
    );
    expect(rebuildEvent?.fields?.forced).toBe(true);

    // And chunks should be present after the rebuild.
    const clientAfter = new Client(DB_CONFIG);
    await clientAfter.connect();
    const res = await clientAfter.query(
      `SELECT * FROM rag_chunks WHERE path = 'auth.ts'`,
    );
    await clientAfter.end();

    expect(res.rows.length).toBeGreaterThan(0);
  });
});
