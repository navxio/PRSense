import { Client } from "pg";
import path from "node:path";
import fs from "node:fs/promises";

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

describe("Incremental indexing (real DB)", () => {
  let repo: string;
  beforeAll(async () => {
    await initTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    repo = await createTestRepo()
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
});
