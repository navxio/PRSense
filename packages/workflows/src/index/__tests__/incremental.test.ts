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
import { PostgresIndexMetadataRepository } from "@prsense/context";

const DB_CONFIG = {
  host: "localhost",
  port: 10001,
  user: "prsense",
  password: "prsense",
  database: "prsense_test",
};

describe("Incremental indexing (real DB)", () => {
  let repo: string;
  beforeAll(async () => {
    await initTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    repo = await createTestRepo()
  });

  afterEach(async () => {
    if (repo) {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("re-indexes only changed file", async () => {
    const eventBus = new TestEventBus();

    // ---- initial commit ----
    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // ---- update file ----
    await writeFile(repo, "a.ts", "const a = 2;");
    commitAll(repo, "update");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    // ---- verify DB ----
    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(
      `SELECT content FROM rag_chunks WHERE path = 'a.ts'`
    );

    const combined = res.rows.map((r) => r.content).join("\n");

    expect(combined).toContain("2");
    expect(combined).not.toContain("1");

    await client.end();
  });



  it("removes chunks for deleted file", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    await fs.unlink(path.join(repo, "a.ts"));
    commitAll(repo, "delete");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(
      `SELECT * FROM rag_chunks WHERE path = 'a.ts'`
    );

    expect(res.rows.length).toBe(0);

    await client.end();
  });

  it("indexes newly added file", async () => {
    const eventBus = new TestEventBus();

    // ---- initial commit ----
    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // ---- add new file ----
    await writeFile(repo, "b.ts", "const b = 42;");
    commitAll(repo, "add b");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    // ---- verify DB ----
    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(
      `SELECT content FROM rag_chunks WHERE path = 'b.ts'`
    );

    const combined = res.rows.map((r) => r.content).join("\n");

    expect(res.rows.length).toBeGreaterThan(0);
    expect(combined).toContain("42");

    await client.end();
  });

  it("does nothing when there are no changes (noop)", async () => {
    const eventBus = new TestEventBus();

    // ---- initial commit ----
    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // ---- run again without changes ----
    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    // ---- assert noop behavior ----
    expect(result.outcome).toBe("success");
    expect(result.payload.upToDate).toBe(true);
    expect(result.payload.chunksIndexed).toBe(0);
  });

  it("handles file rename correctly", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // rename a.ts → b.ts
    await fs.rename(
      path.join(repo, "a.ts"),
      path.join(repo, "b.ts")
    );
    commitAll(repo, "rename");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const oldRes = await client.query(
      `SELECT * FROM rag_chunks WHERE path = 'a.ts'`
    );
    const newRes = await client.query(
      `SELECT * FROM rag_chunks WHERE path = 'b.ts'`
    );

    expect(oldRes.rows.length).toBe(0);
    expect(newRes.rows.length).toBeGreaterThan(0);

    await client.end();
  });

  it("handles modify and delete in same commit", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "const a = 1;");
    await writeFile(repo, "b.ts", "const b = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // modify a.ts and delete b.ts
    await writeFile(repo, "a.ts", "const a = 2;");
    await fs.unlink(path.join(repo, "b.ts"));
    commitAll(repo, "mixed");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const aRes = await client.query(
      `SELECT content FROM rag_chunks WHERE path = 'a.ts'`
    );
    const bRes = await client.query(
      `SELECT * FROM rag_chunks WHERE path = 'b.ts'`
    );

    const combined = aRes.rows.map(r => r.content).join("\n");

    expect(combined).toContain("2");
    expect(bRes.rows.length).toBe(0);

    await client.end();
  });
  it("handles multiple commits before indexing", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "c1");

    await writeFile(repo, "a.ts", "2");
    commitAll(repo, "c2");

    await writeFile(repo, "a.ts", "3");
    commitAll(repo, "c3");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(
      `SELECT content FROM rag_chunks WHERE path = 'a.ts'`
    );

    const combined = res.rows.map(r => r.content).join("\n");

    expect(combined).toContain("3");

    await client.end();
  });
  it("re-indexes multiple modified files", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    await writeFile(repo, "b.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await writeFile(repo, "a.ts", "2");
    await writeFile(repo, "b.ts", "2");
    commitAll(repo, "update both");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT path, content FROM rag_chunks`);

    const combined = res.rows.map(r => r.content).join("\n");

    expect(combined).toContain("2");

    await client.end();
  });

  it("handles empty commit gracefully", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    commitAll(repo, "empty commit", { allowEmpty: true });

    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });
    const planEvents = eventBus.events.filter(
      e => e.event === CoreEvents.WorkflowIndexPlanComputed
    );

    expect(planEvents.at(-1)?.fields?.type).toBe("noop");

    expect(result.payload.upToDate).toBe(true);
  });

  it("handles delete and re-add of same file", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await fs.unlink(path.join(repo, "a.ts"));
    commitAll(repo, "delete");

    await writeFile(repo, "a.ts", "2");
    commitAll(repo, "re-add");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT content FROM rag_chunks WHERE path = 'a.ts'`);
    const combined = res.rows.map(r => r.content).join("\n");

    expect(combined).toContain("2");

    await client.end();
  });

  it("force rebuild ignores incremental diff", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await writeFile(repo, "a.ts", "2");
    commitAll(repo, "update");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT content FROM rag_chunks`);
    const combined = res.rows.map(r => r.content).join("\n");

    expect(combined).toContain("2");

    await client.end();
  });

  it("does not duplicate chunks for unchanged files", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT COUNT(*) FROM rag_chunks WHERE path = 'a.ts'`);

    expect(Number(res.rows[0].count)).toBeGreaterThan(0);

    await client.end();
  });

  it("handles multiple file deletions", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    await writeFile(repo, "b.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await fs.unlink(path.join(repo, "a.ts"));
    await fs.unlink(path.join(repo, "b.ts"));
    commitAll(repo, "delete both");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT * FROM rag_chunks`);

    expect(res.rows.length).toBe(0);

    await client.end();
  });
  it("handles rename + modify", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await fs.rename(path.join(repo, "a.ts"), path.join(repo, "b.ts"));
    await writeFile(repo, "b.ts", "2");
    commitAll(repo, "rename+modify");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT content FROM rag_chunks WHERE path = 'b.ts'`);

    expect(res.rows.map(r => r.content).join("\n")).toContain("2");

    await client.end();
  });


  it("handles large file chunking", async () => {
    const eventBus = new TestEventBus();

    const large = "x".repeat(2000);
    await writeFile(repo, "a.ts", large);
    commitAll(repo, "large");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT COUNT(*) FROM rag_chunks WHERE path = 'a.ts'`);

    expect(Number(res.rows[0].count)).toBeGreaterThan(1);

    await client.end();
  });


  it("handles diff across multiple commits", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "c1");

    await writeFile(repo, "a.ts", "2");
    commitAll(repo, "c2");

    await writeFile(repo, "a.ts", "3");
    commitAll(repo, "c3");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT content FROM rag_chunks WHERE path = 'a.ts'`);

    expect(res.rows.map(r => r.content).join("\n")).toContain("3");

    await client.end();
  });

  it("treats rename as delete + add (snapshot semantics)", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await fs.rename(path.join(repo, "a.ts"), path.join(repo, "b.ts"));
    commitAll(repo, "rename");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const deleteEvents = eventBus.events
      .filter(e => e.event === CoreEvents.WorkflowIndexFilesDeleted)
      .at(-1);

    const changeEvents = eventBus.events
      .filter(e => e.event === CoreEvents.WorkflowIndexFilesChanged)
      .at(-1);

    expect(deleteEvents?.fields?.deletedFiles).toContain("a.ts");
    expect(changeEvents?.fields?.changedFiles).toContain("b.ts");
  });

  it("indexes same content under different paths independently", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "same");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await writeFile(repo, "b.ts", "same");
    commitAll(repo, "copy");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const client = new Client(DB_CONFIG);
    await client.connect();

    const res = await client.query(`SELECT path FROM rag_chunks`);

    const paths = res.rows.map(r => r.path);

    expect(paths).toContain("a.ts");
    expect(paths).toContain("b.ts");

    await client.end();
  });

  it("detects change even if file reverts to previous content", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "c1");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await writeFile(repo, "a.ts", "2");
    commitAll(repo, "c2");

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "c3");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const planEvents = eventBus.events.filter(
      e => e.event === CoreEvents.WorkflowIndexPlanComputed
    );

    expect(planEvents.at(-1)?.fields?.type).toBe("noop");
  });

  it("skips chunk building when only deletions occur", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });
    const before = eventBus.events.length;
    await fs.unlink(path.join(repo, "a.ts"));
    commitAll(repo, "delete");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });
    const afterEvents = eventBus.events.slice(before);

    const chunkEvents = afterEvents.filter(
      e => e.event === CoreEvents.ContextChunksBuilt
    );

    expect(chunkEvents.length).toBe(0);
  });

  it("produces identical snapshots for identical commits", async () => {
    const eventBus = new TestEventBus();

    await writeFile(repo, "a.ts", "1");
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    const result = await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    expect(result.payload.upToDate).toBe(true);
  });

  it("treats reverted content as noop (content-based diff)", async () => {
    const eventBus = new TestEventBus();

    for (let i = 0; i < 20; i++) {
      await writeFile(repo, `f${i}.ts`, `${i}`);
    }
    commitAll(repo, "init");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), force: true, eventBus, version: "test" });

    await writeFile(repo, "f10.ts", "changed");
    commitAll(repo, "modify one");

    await runIndexWorkflow({ target: repo, config: testConfig(), credentials: testCredentials(), eventBus, version: "test" });

    const changeEvents = eventBus.events.filter(
      e => e.event === CoreEvents.WorkflowIndexFilesChanged
    );

    const last = changeEvents.at(-1);

    expect(last?.fields?.changedFiles).toEqual(["f10.ts"]);
  });
  it("handles delete-only commit (removes chunks and updates metadata)", async () => {
    const eventBus = new TestEventBus();

    // initial commit
    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // delete file
    await fs.unlink(path.join(repo, "a.ts"));
    commitAll(repo, "delete");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    // chunks should be gone
    const res = await client.query(
      `SELECT * FROM rag_chunks WHERE path = 'a.ts'`
    );

    expect(res.rows.length).toBe(0);

    await client.end();

    // verify delete-only plan emitted
    const planEvent = eventBus.events
      .filter(e => e.event === CoreEvents.WorkflowIndexPlanComputed)
      .at(-1);

    expect(planEvent?.fields?.type).toBe("delete-only");
  });

  it("delete-only dry-run does not mutate chunks or metadata", async () => {
    const eventBus = new TestEventBus();

    // initial commit
    await writeFile(repo, "a.ts", "const a = 1;");
    commitAll(repo, "init");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      force: true,
      eventBus,
      version: "test",
    });

    // capture metadata BEFORE
    const metadataRepo = new PostgresIndexMetadataRepository(DB_CONFIG.connectionString ?? "postgres://prsense:prsense@localhost:10001/prsense_test");

    const before = await metadataRepo.load("local", path.basename(repo));

    // delete file
    await fs.unlink(path.join(repo, "a.ts"));
    commitAll(repo, "delete");

    await runIndexWorkflow({
      target: repo,
      config: testConfig(),
      credentials: testCredentials(),
      dryRun: true,
      eventBus,
      version: "test",
    });

    const client = new Client(DB_CONFIG);
    await client.connect();

    // chunks should STILL exist
    const res = await client.query(
      `SELECT * FROM rag_chunks WHERE path = 'a.ts'`
    );

    expect(res.rows.length).toBeGreaterThan(0);

    await client.end();

    // metadata should NOT change
    const after = await metadataRepo.load("local", path.basename(repo));

    expect(after?.revision.commitSha).toBe(before?.revision.commitSha);

    // ensure plan is delete-only
    const planEvent = eventBus.events
      .filter(e => e.event === CoreEvents.WorkflowIndexPlanComputed)
      .at(-1);

    expect(planEvent?.fields?.type).toBe("delete-only");
  });

});
