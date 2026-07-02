// packages/context/src/repository/__tests__/RefAwareRepositorySource.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { RefAwareRepositorySource } from "../RefAwareRepositorySource.js";
import type { GitBackedRepositorySource } from "../GitBackedRepositorySource.js";

const execFile = promisify(execFileCb);
async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout.trim();
}

// Minimal inner source: only getLocalPath + getRevision are exercised by the
// ref-aware wrapper; the rest throw so an accidental delegation is caught.
function innerFor(
  repoPath: string,
  revision: { commitSha: string; defaultBranch?: string },
): GitBackedRepositorySource {
  return {
    getLocalPath: () => repoPath,
    getRevision: async () => revision,
    getRepositoryIdentity: () => ({ provider: "github", id: "acme/widgets" }),
    listFiles: async () => {
      throw new Error("inner.listFiles should not be called");
    },
    readFile: async () => {
      throw new Error("inner.readFile should not be called");
    },
  };
}

describe("RefAwareRepositorySource", () => {
  let repoRoot: string;
  let firstSha: string;
  let headSha: string;

  beforeAll(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "ref-"));
    await git(repoRoot, "init", "-q", "--initial-branch=main");
    await git(repoRoot, "config", "user.email", "test@example.com");
    await git(repoRoot, "config", "user.name", "test");
    await git(repoRoot, "config", "commit.gpgsign", "false");

    await writeFile(join(repoRoot, "a.ts"), "export const a = 1;\n");
    await mkdir(join(repoRoot, "src"), { recursive: true });
    await writeFile(join(repoRoot, "src/b.ts"), "export const b = 2;\n");
    // a binary file: NUL bytes in first 8000
    await writeFile(join(repoRoot, "bin.dat"), Buffer.from([1, 2, 0, 3, 4]));
    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "first");
    firstSha = await git(repoRoot, "rev-parse", "HEAD");

    // second commit removes a.ts so it's absent at HEAD but present at firstSha
    await rm(join(repoRoot, "a.ts"));
    await writeFile(join(repoRoot, "src/c.ts"), "export const c = 3;\n");
    await git(repoRoot, "add", "-A");
    await git(repoRoot, "commit", "-q", "-m", "second");
    headSha = await git(repoRoot, "rev-parse", "HEAD");
    await git(repoRoot, "tag", "v1");
  });

  afterAll(async () => {
    if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
  });

  it("resolves a branch ref to a commit SHA", async () => {
    const src = new RefAwareRepositorySource(
      innerFor(repoRoot, { commitSha: "ignored" }),
      "main",
    );
    const rev = await src.getRevision();
    expect(rev.commitSha).toBe(headSha);
  });

  it("resolves a tag ref", async () => {
    const src = new RefAwareRepositorySource(
      innerFor(repoRoot, { commitSha: "ignored" }),
      "v1",
    );
    expect((await src.getRevision()).commitSha).toBe(headSha);
  });

  it("reads a file at the pinned ref, isolated from working tree", async () => {
    const src = new RefAwareRepositorySource(
      innerFor(repoRoot, { commitSha: "x" }),
      firstSha,
    );
    expect(await src.readFile("a.ts")).toBe("export const a = 1;\n");
  });

  it("lists files at the pinned ref, not HEAD", async () => {
    const atFirst = new RefAwareRepositorySource(
      innerFor(repoRoot, { commitSha: "x" }),
      firstSha,
    );
    const files = await atFirst.listFiles();
    expect(files.sort()).toEqual(["a.ts", "bin.dat", "src/b.ts"]);
  });

  it("defaults defaultBranch to 'main' when inner omits it", async () => {
    const src = new RefAwareRepositorySource(
      innerFor(repoRoot, { commitSha: "x" }),
      "main",
    );
    expect((await src.getRevision()).defaultBranch).toBe("main");
  });

  it("preserves inner defaultBranch when present", async () => {
    const src = new RefAwareRepositorySource(
      innerFor(repoRoot, { commitSha: "x", defaultBranch: "trunk" }),
      "main",
    );
    expect((await src.getRevision()).defaultBranch).toBe("trunk");
  });

  describe("readFile guards", () => {
    const src = () =>
      new RefAwareRepositorySource(
        innerFor(repoRoot, { commitSha: "x" }),
        firstSha,
      );

    it("rejects parent-directory traversal", async () => {
      await expect(src().readFile("../secret")).rejects.toThrow(
        "PATH_OUTSIDE_REPOSITORY",
      );
    });

    it("rejects nested traversal segments", async () => {
      await expect(src().readFile("src/../../etc/passwd")).rejects.toThrow(
        "PATH_OUTSIDE_REPOSITORY",
      );
    });

    it("rejects absolute paths", async () => {
      await expect(src().readFile("/etc/passwd")).rejects.toThrow(
        "PATH_OUTSIDE_REPOSITORY",
      );
    });

    it("throws a not-found error for a missing file at the ref", async () => {
      // a.ts exists at firstSha; use HEAD where it was deleted
      const atHead = new RefAwareRepositorySource(
        innerFor(repoRoot, { commitSha: "x" }),
        headSha,
      );
      await expect(atHead.readFile("a.ts")).rejects.toThrow(/File not found/);
    });

    it("detects binary files", async () => {
      await expect(src().readFile("bin.dat")).rejects.toThrow(
        "BINARY_FILE_DETECTED",
      );
    });
  });
});
