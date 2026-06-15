// packages/context/src/symbol-graph/git/__tests__/gitObjectReader.test.ts
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import {
  createGitObjectReader,
  type GitObjectReader,
} from "../gitObjectReader.js";

const execFile = promisify(execFileCb);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout.trim();
}

describe("gitObjectReader", () => {
  let repoRoot: string;
  let firstSha: string;
  let secondSha: string;

  beforeAll(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "gor-"));
    await git(repoRoot, "init", "-q", "--initial-branch=main");
    await git(repoRoot, "config", "user.email", "test@example.com");
    await git(repoRoot, "config", "user.name", "test");
    await git(repoRoot, "config", "commit.gpgsign", "false");

    await writeFile(join(repoRoot, "a.ts"), "export const a = 1;\n");
    await mkdir(join(repoRoot, "src"), { recursive: true });
    await writeFile(join(repoRoot, "src/b.ts"), "export const b = 2;\n");
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "first");
    firstSha = await git(repoRoot, "rev-parse", "HEAD");

    await writeFile(join(repoRoot, "a.ts"), "export const a = 100;\n");
    await writeFile(join(repoRoot, "src/c.ts"), "export const c = 3;\n");
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "second");
    secondSha = await git(repoRoot, "rev-parse", "HEAD");
  });

  afterAll(async () => {
    if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
  });

  describe("readBlob", () => {
    let reader: GitObjectReader;

    beforeEach(() => {
      reader = createGitObjectReader(repoRoot);
    });
    afterEach(async () => {
      await reader.close();
    });

    test("reads a blob at a specific SHA", async () => {
      const content = await reader.readBlob(firstSha, "a.ts");
      expect(content).toBe("export const a = 1;\n");
    });

    test("reads the updated blob at a later SHA", async () => {
      const content = await reader.readBlob(secondSha, "a.ts");
      expect(content).toBe("export const a = 100;\n");
    });

    test("reads files in nested paths", async () => {
      const content = await reader.readBlob(secondSha, "src/b.ts");
      expect(content).toBe("export const b = 2;\n");
    });

    test("rejects when path does not exist at SHA", async () => {
      // src/c.ts was added in the second commit; absent at firstSha.
      await expect(reader.readBlob(firstSha, "src/c.ts")).rejects.toThrow(
        /not found/i,
      );
    });

    test("serializes concurrent reads, resolves each to the right content", async () => {
      const [a, b, c, aAgain] = await Promise.all([
        reader.readBlob(firstSha, "a.ts"),
        reader.readBlob(secondSha, "a.ts"),
        reader.readBlob(secondSha, "src/b.ts"),
        reader.readBlob(firstSha, "a.ts"),
      ]);
      expect(a).toBe("export const a = 1;\n");
      expect(b).toBe("export const a = 100;\n");
      expect(c).toBe("export const b = 2;\n");
      expect(aAgain).toBe("export const a = 1;\n");
    });

    test("interleaves present and missing without losing alignment", async () => {
      const results = await Promise.allSettled([
        reader.readBlob(secondSha, "a.ts"),
        reader.readBlob(firstSha, "src/c.ts"), // missing
        reader.readBlob(secondSha, "src/b.ts"),
      ]);
      expect(results[0]).toMatchObject({
        status: "fulfilled",
        value: "export const a = 100;\n",
      });
      expect(results[1]).toMatchObject({ status: "rejected" });
      expect(results[2]).toMatchObject({
        status: "fulfilled",
        value: "export const b = 2;\n",
      });
    });
  });

  describe("listTree", () => {
    let reader: GitObjectReader;

    beforeEach(() => {
      reader = createGitObjectReader(repoRoot);
    });
    afterEach(async () => {
      await reader.close();
    });

    test("returns all blobs at the given SHA", async () => {
      const entries = await reader.listTree(secondSha);
      const paths = entries.map((e) => e.path).sort();
      expect(paths).toEqual(["a.ts", "src/b.ts", "src/c.ts"]);
    });

    test("reflects tree differences across SHAs", async () => {
      const first = (await reader.listTree(firstSha)).map((e) => e.path).sort();
      const second = (await reader.listTree(secondSha))
        .map((e) => e.path)
        .sort();
      expect(first).toEqual(["a.ts", "src/b.ts"]);
      expect(second).toEqual(["a.ts", "src/b.ts", "src/c.ts"]);
    });

    test("yields 40-char hex oids", async () => {
      const entries = await reader.listTree(secondSha);
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.oid).toMatch(/^[0-9a-f]{40}$/);
      }
    });
  });

  describe("close", () => {
    test("rejects subsequent readBlob calls", async () => {
      const reader = createGitObjectReader(repoRoot);
      await reader.readBlob(firstSha, "a.ts"); // warm the proc
      await reader.close();
      await expect(reader.readBlob(firstSha, "a.ts")).rejects.toThrow(
        /closed/i,
      );
    });

    test("is idempotent and safe before any work", async () => {
      const reader = createGitObjectReader(repoRoot);
      await expect(reader.close()).resolves.toBeUndefined();
      await expect(reader.close()).resolves.toBeUndefined();
    });
  });
});
