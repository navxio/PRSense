// apps/cli/src/__tests__/cli.smoke.test.ts
import { describe, it, expect, beforeAll } from "@jest/globals";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { createTestRepo } from "./helper.js";

const execFileAsync = promisify(execFile);

// Resolve once at module load. Adjust the relative path to match where
// this test file actually lives relative to repo root.
const CLI_PATH = path.resolve(__dirname, "../../dist/index.js");

async function runCli(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      [CLI_PATH, ...args],
      {
        cwd: opts.cwd ?? process.cwd(),
        env: {
          ...process.env,
          PRSENSE_NON_INTERACTIVE: "1",
          ...opts.env,
        },
        timeout: 30_000,
      },
    );
    return { exitCode: 0, stdout, stderr };
  } catch (err: any) {
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

describe("CLI smoke tests", () => {
  beforeAll(async () => {
    // Verify the built binary exists. If not, fail loudly with a hint
    // rather than letting every test produce a cryptic ENOENT.
    try {
      await fs.access(CLI_PATH);
    } catch {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run 'pnpm build' before running smoke tests.`,
      );
    }
  });

  it("prints help text and exits 0", async () => {
    const { exitCode, stdout } = await runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("review");
    expect(stdout).toContain("index");
    expect(stdout).toContain("doctor");
  });

  it("prints a version and exits 0", async () => {
    const { exitCode, stdout } = await runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it("config inspect runs against a fresh repo without throwing", async () => {
    const repo = await createTestRepo();
    try {
      const { exitCode, stdout } = await runCli(["config", "inspect"], {
        cwd: repo,
      });
      expect(exitCode).toBe(0);
      expect(stdout.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("index --list runs without indexed repos and exits 0", async () => {
    const repo = await createTestRepo();
    try {
      const { exitCode } = await runCli(["index", "--list"], { cwd: repo });
      expect(exitCode).toBe(0);
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });

  it("doctor runs and exits 0 on a fresh repo with default config", async () => {
    const repo = await createTestRepo();
    try {
      const { exitCode } = await runCli(["doctor"], { cwd: repo });
      expect(exitCode).toBe(0);
    } finally {
      await fs.rm(repo, { recursive: true, force: true });
    }
  });
});
