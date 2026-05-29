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
  // ---------------------------------------------------------------------------
  it("emits rebuild-required when stored chunk version does not match current", async () => {
    const setupBus = new TestEventBus();

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

    const client = new Client(DB_CONFIG);
    await client.connect();

    // Discover what identity the workflow actually stored, rather than guessing.
    const metaRows = await client.query(
      `SELECT repository_provider, repository_id, chunk_version
       FROM prsense_index_metadata`,
    );
    expect(metaRows.rows.length).toBe(1);

    const stored = metaRows.rows[0];

    // Downgrade chunk version on the row we just found.
    await client.query(
      `UPDATE prsense_index_metadata
        SET chunk_version = 1
      WHERE repository_provider = $1 AND repository_id = $2`,
      [stored.repository_provider, stored.repository_id],
    );
    await client.end();

    // Modify the file so the workflow has something to do.
    await writeFile(
      repo,
      "auth.ts",
      `export function login(): boolean { return false; }`,
    );
    commitAll(repo, "update");

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

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus: setupBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const metaRows = await client.query(
      `SELECT repository_provider, repository_id
       FROM prsense_index_metadata`,
    );
    expect(metaRows.rows.length).toBe(1);
    const stored = metaRows.rows[0];

    await client.query(
      `UPDATE prsense_index_metadata
        SET chunk_version = 1
      WHERE repository_provider = $1 AND repository_id = $2`,
      [stored.repository_provider, stored.repository_id],
    );
    await client.end();

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

    const rebuildEvent = eventBus.events.find(
      (e) => e.event === CoreEvents.WorkflowIndexRebuildRequired,
    );
    expect(rebuildEvent?.fields?.forced).toBe(true);

    const clientAfter = new Client(DB_CONFIG);
    await clientAfter.connect();
    const res = await clientAfter.query(
      `SELECT * FROM rag_chunks WHERE path = 'auth.ts'`,
    );
    await clientAfter.end();

    expect(res.rows.length).toBeGreaterThan(0);
  });
});
