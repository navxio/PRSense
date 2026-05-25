// packages/context/src/repository/RefAwareRepositorySource.ts

import { execFileSync } from "node:child_process";
import {
  GitBackedRepositorySource,
  RepositoryIdentity,
  RepositoryRevision,
} from "./GitBackedRepositorySource.js";
/**
 * Wraps a GitBackedRepositorySource to read from a specific commit-ish ref
 * (branch name, tag, or SHA). Tree-ish expressions (e.g. HEAD^{tree}) are
 * not supported.
 */
export class RefAwareRepositorySource implements GitBackedRepositorySource {
  private readonly resolvedSha: string;
  constructor(
    private readonly inner: GitBackedRepositorySource,
    private readonly ref: string,
  ) {
    const repoPath = this.inner.getLocalPath();
    this.resolvedSha = execFileSync("git", ["rev-parse", `${ref}^{commit}`], {
      cwd: repoPath,
      encoding: "utf8",
    }).trim();
  }

  getRepositoryIdentity(): RepositoryIdentity {
    return this.inner.getRepositoryIdentity();
  }

  getLocalPath(): string {
    return this.inner.getLocalPath();
  }

  async getRevision(): Promise<RepositoryRevision> {
    const inner = await this.inner.getRevision();
    return {
      commitSha: this.resolvedSha,
      defaultBranch: inner.defaultBranch ?? "main",
    };
  }

  async listFiles(): Promise<string[]> {
    const repoPath = this.inner.getLocalPath();

    const output = execFileSync(
      "git",
      [
        "-c",
        "core.quotepath=false",
        "ls-tree",
        "-r",
        "--name-only",
        "-z",
        this.resolvedSha,
      ],
      { cwd: repoPath },
    );

    return output.toString("utf8").split("\0").filter(Boolean);
  }

  async readFile(filePath: string): Promise<string> {
    const repoPath = this.inner.getLocalPath();

    const segments = filePath.split("/");
    if (segments.some((s) => s === "..") || filePath.startsWith("/")) {
      throw new Error("PATH_OUTSIDE_REPOSITORY");
    }

    let buffer: Buffer;

    try {
      buffer = execFileSync(
        "git",
        ["show", `${this.resolvedSha}:${filePath}`],
        {
          cwd: repoPath,
        },
      );
    } catch (err: any) {
      const stderr = err?.stderr?.toString() ?? "";
      if (
        stderr.includes("does not exist") ||
        stderr.includes("not exist in")
      ) {
        throw new Error(`File not found at ${this.resolvedSha}:${filePath}`);
      }
      throw new Error(
        `git show failed for ${this.resolvedSha}:${filePath}: ${stderr.trim() || err.message}`,
      );
    }

    const sampleSize = Math.min(buffer.length, 8000);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) {
        throw new Error("BINARY_FILE_DETECTED");
      }
    }

    return buffer.toString("utf8").replace(/\u0000/g, "");
  }
}
