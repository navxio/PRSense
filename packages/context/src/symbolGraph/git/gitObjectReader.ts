// packages/context/src/symbolGraph/git/gitObjectReader.ts
//
// Reads git objects at arbitrary SHAs without touching the working tree.
// Used by SymbolGraphContextProvider to materialize base into an in-memory
// FileSystemHost for ts-morph.
//
// Usage:
//   const reader = createGitObjectReader(repoRoot);
//   try {
//     const tree = await reader.listTree(baseSha);
//     for (const { path } of tree) {
//       const content = await reader.readBlob(baseSha, path);
//       ...
//     }
//   } finally {
//     await reader.close();
//   }

import {
  spawn,
  execFile as execFileCb,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type TreeEntry = { path: string; oid: string };

export interface GitObjectReader {
  readBlob(sha: string, path: string): Promise<string>;
  listTree(sha: string): Promise<TreeEntry[]>;
  close(): Promise<void>;
}

export function createGitObjectReader(repoRoot: string): GitObjectReader {
  return new GitObjectReaderImpl(repoRoot);
}

type PendingRequest = {
  resolve: (content: string) => void;
  reject: (err: Error) => void;
  query: string;
};

type ParserState =
  | { kind: "awaiting-header" }
  | { kind: "awaiting-content"; size: number };

class GitObjectReaderImpl implements GitObjectReader {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private queue: PendingRequest[] = [];
  private current: PendingRequest | null = null;
  private state: ParserState = { kind: "awaiting-header" };
  private fatalError: Error | null = null;
  private closed = false;

  constructor(private readonly repoRoot: string) {}

  async readBlob(sha: string, path: string): Promise<string> {
    return this.enqueue(`${sha}:${path}`);
  }

  // ls-tree is one-shot, no streaming benefit — exec and parse.
  async listTree(sha: string): Promise<TreeEntry[]> {
    const { stdout } = await execFile("git", ["ls-tree", "-r", "-z", sha], {
      cwd: this.repoRoot,
      maxBuffer: 256 * 1024 * 1024,
    });

    const entries: TreeEntry[] = [];
    for (const record of stdout.split("\0")) {
      if (!record) continue;
      // "<mode> <type> <oid>\t<path>"
      const tabIdx = record.indexOf("\t");
      if (tabIdx === -1) continue;
      const meta = record.slice(0, tabIdx);
      const path = record.slice(tabIdx + 1);
      const parts = meta.split(" ");
      if (parts.length !== 3) continue;
      const [, type, oid] = parts;
      if (type !== "blob" || !oid) continue;
      entries.push({ path, oid });
    }
    return entries;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    const err = new Error("reader closed");
    for (const req of this.queue) req.reject(err);
    this.queue = [];
    if (this.current) {
      this.current.reject(err);
      this.current = null;
    }

    const proc = this.proc;
    this.proc = null;
    if (!proc) return;

    proc.stdin.end();
    await new Promise<void>((resolve) => {
      proc.once("exit", () => resolve());
      setTimeout(() => {
        proc.kill("SIGKILL");
        resolve();
      }, 1000).unref();
    });
  }

  private enqueue(query: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.closed) return reject(new Error("reader closed"));
      if (this.fatalError) return reject(this.fatalError);
      this.queue.push({ resolve, reject, query });
      this.pump();
    });
  }

  private pump(): void {
    if (this.current || this.closed) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    const proc = this.ensureProc();
    proc.stdin.write(`${next.query}\n`);
  }

  private ensureProc(): ChildProcessWithoutNullStreams {
    if (this.proc) return this.proc;

    const proc = spawn("git", ["cat-file", "--batch"], {
      cwd: this.repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    proc.on("exit", (code) => this.onExit(code));
    proc.on("error", (e) => this.fail(e));
    proc.stderr.resume(); // drain; ignore unless exit code is non-zero

    this.proc = proc;
    return proc;
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.drain();
  }

  // Streaming parser for `git cat-file --batch` responses.
  // Header: "<oid> <type> <size>\n"   or   "<query> missing\n"
  // Body:   <size> bytes + trailing "\n"
  private drain(): void {
    while (true) {
      if (this.state.kind === "awaiting-header") {
        const nl = this.buffer.indexOf(0x0a);
        if (nl === -1) return;
        const line = this.buffer.subarray(0, nl).toString("utf8");
        this.buffer = this.buffer.subarray(nl + 1);

        const req = this.current;
        if (!req) {
          this.fail(new Error(`unexpected output from git cat-file: ${line}`));
          return;
        }

        if (line.endsWith(" missing")) {
          req.reject(new Error(`git object not found: ${req.query}`));
          this.current = null;
          this.pump();
          continue;
        }

        const parts = line.split(" ");
        const sizeStr = parts.length === 3 ? parts[2] : undefined;
        const size = sizeStr ? Number.parseInt(sizeStr, 10) : NaN;
        if (!Number.isFinite(size) || size < 0) {
          req.reject(new Error(`malformed git header: ${line}`));
          this.current = null;
          this.pump();
          continue;
        }
        this.state = { kind: "awaiting-content", size };
      }

      if (this.state.kind === "awaiting-content") {
        const needed = this.state.size + 1; // content + trailing newline
        if (this.buffer.length < needed) return;
        const content = this.buffer
          .subarray(0, this.state.size)
          .toString("utf8");
        this.buffer = this.buffer.subarray(needed);
        const req = this.current;
        this.current = null;
        this.state = { kind: "awaiting-header" };
        if (req) req.resolve(content);
        this.pump();
      }
    }
  }

  private onExit(code: number | null): void {
    if (code !== 0 && code !== null) {
      this.fail(new Error(`git cat-file exited with code ${code}`));
    }
  }

  private fail(err: Error): void {
    if (this.fatalError) return;
    this.fatalError = err;
    if (this.current) {
      this.current.reject(err);
      this.current = null;
    }
    for (const req of this.queue) req.reject(err);
    this.queue = [];
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        /* noop */
      }
      this.proc = null;
    }
  }
}

/*
 * Single long lived process;fifo queue. Concurrent readBlob calls serialise correctly on the process and resolve in order
 * parser is a 2 state machine - awaiting-header parses one line, then awaiting-content reads exactly size+1 byets. State persits across drain() calls when bytes arrive split.
 * listTree uses -z so paths with newlines/spaces parse safely. maxBuffer bumped to 256MB for big monorepos; ls-tree output is one line per blob so even huge repos stay under that comfortably
 * close() rejects inflight+queued requests, sends eof to stdin, waits up to 1s for graceful exit. sigkill fallback.
 * readBlob after close() rejects with "reader closed", never re spawns
 * Encoding: utf-8 assumed. Fine for .ts, .tsx, tsconfig.json, package.json. Binary blobs(rare in the file set we materialise) would be mangled, but they shouldn't be requested
 * stderr drained but not captured; non-zero exit code surfaces as a fatal error on the next operation
 * */
