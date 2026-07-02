// packages/context/src/symbolGraph/git/__tests__/gitObjectReader.edge.test.ts
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
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

// Edge cases beyond the happy-path suite: content that stresses the streaming
// parser (large multi-chunk, multibyte, CRLF, empty) and error handling
// (missing-then-present ordering, malformed refs).
describe("gitObjectReader (edge cases)", () => {
  let repoRoot: string;
  let sha: string;

  const BIG = "X".repeat(2 * 1024 * 1024); // > one stdout chunk
  const UNI = "café ☕ 日本語 — naïve\n"; // multibyte utf-8
  const CRLF = "line1\r\nline2\r\n"; // carriage returns must survive

  beforeAll(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "gor-edge-"));
    await git(repoRoot, "init", "-q", "--initial-branch=main");
    await git(repoRoot, "config", "user.email", "test@example.com");
    await git(repoRoot, "config", "user.name", "test");
    await git(repoRoot, "config", "commit.gpgsign", "false");

    await writeFile(join(repoRoot, "big.txt"), BIG);
    await writeFile(join(repoRoot, "uni.txt"), UNI);
    // write CRLF via buffer so the filesystem doesn't normalize it
    await writeFile(join(repoRoot, "crlf.txt"), Buffer.from(CRLF, "utf8"));
    await writeFile(join(repoRoot, "empty.txt"), "");
    await mkdir(join(repoRoot, "src"), { recursive: true });
    await writeFile(join(repoRoot, "src/small.ts"), "export const s = 1;\n");
    // prevent git's autocrlf from rewriting crlf.txt on checkout/add
    await writeFile(join(repoRoot, ".gitattributes"), "* -text\n");

    await git(repoRoot, "add", ".");
    await git(repoRoot, "commit", "-q", "-m", "fixtures");
    sha = await git(repoRoot, "rev-parse", "HEAD");
  });

  afterAll(async () => {
    if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
  });

  let reader: GitObjectReader;
  beforeEach(() => {
    reader = createGitObjectReader(repoRoot);
  });
  afterEach(async () => {
    await reader.close();
  });

  it("reads a large blob spanning multiple stdout chunks", async () => {
    const content = await reader.readBlob(sha, "big.txt");
    expect(content.length).toBe(BIG.length);
    expect(content).toBe(BIG);
  });

  it("preserves multibyte UTF-8 content", async () => {
    expect(await reader.readBlob(sha, "uni.txt")).toBe(UNI);
  });

  it("does not strip carriage returns", async () => {
    expect(await reader.readBlob(sha, "crlf.txt")).toBe(CRLF);
  });

  it("reads an empty blob as the empty string", async () => {
    expect(await reader.readBlob(sha, "empty.txt")).toBe("");
  });

  it("recovers alignment after a missing object mid-stream", async () => {
    // missing → present → present, all on one warm process. A parser that
    // mishandled the 'missing' line would desync the following reads.
    const results = await Promise.allSettled([
      reader.readBlob(sha, "does/not/exist.ts"),
      reader.readBlob(sha, "big.txt"),
      reader.readBlob(sha, "src/small.ts"),
    ]);
    expect(results[0]?.status).toBe("rejected");
    expect(results[1]).toMatchObject({ status: "fulfilled", value: BIG });
    expect(results[2]).toMatchObject({
      status: "fulfilled",
      value: "export const s = 1;\n",
    });
  });

  it("interleaves a large read between two small ones without corruption", async () => {
    const [a, big, b] = await Promise.all([
      reader.readBlob(sha, "src/small.ts"),
      reader.readBlob(sha, "big.txt"),
      reader.readBlob(sha, "uni.txt"),
    ]);
    expect(a).toBe("export const s = 1;\n");
    expect(big).toBe(BIG);
    expect(b).toBe(UNI);
  });

  it("rejects a malformed/nonexistent ref", async () => {
    await expect(
      reader.readBlob("0000000000000000000000000000000000000000", "big.txt"),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects a syntactically invalid sha without desyncing the stream", async () => {
    const results = await Promise.allSettled([
      reader.readBlob("not-a-sha", "big.txt"),
      reader.readBlob(sha, "src/small.ts"),
    ]);
    expect(results[0]?.status).toBe("rejected");
    // The valid read after it must still resolve correctly.
    expect(results[1]).toMatchObject({
      status: "fulfilled",
      value: "export const s = 1;\n",
    });
  });
});
