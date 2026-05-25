// packages/context/src/repository/RefAwareRepositorySource.ts

import { execSync } from "node:child_process";
import {
  GitBackedRepositorySource,
  RepositoryIdentity,
  RepositoryRevision,
} from "./GitBackedRepositorySource.js";

export class RefAwareRepositorySource implements GitBackedRepositorySource {
  constructor(
    private readonly inner: GitBackedRepositorySource,
    private readonly ref: string,
  ) {}

  getRepositoryIdentity(): RepositoryIdentity {
    return this.inner.getRepositoryIdentity();
  }

  getLocalPath(): string {
    return this.inner.getLocalPath();
  }

  async getRevision(): Promise<RepositoryRevision> {
    const repoPath = this.inner.getLocalPath();

    const sha = execSync(`git rev-parse ${this.ref}`, {
      cwd: repoPath,
      encoding: "utf8",
    }).trim();

    return {
      commitSha: sha,
      defaultBranch: this.ref,
    };
  }

  async listFiles(): Promise<string[]> {
    const repoPath = this.inner.getLocalPath();

    const output = execSync(
      `git -c core.quotepath=false ls-tree -r --name-only -z ${this.ref}`,
      { cwd: repoPath },
    );

    return output.toString("utf8").split("\0").filter(Boolean);
  }

  async readFile(filePath: string): Promise<string> {
    const repoPath = this.inner.getLocalPath();

    // Security: reject path traversal
    if (filePath.includes("..") || filePath.startsWith("/")) {
      throw new Error("PATH_OUTSIDE_REPOSITORY");
    }

    let content: string;

    try {
      content = execSync(`git show ${this.ref}:${filePath}`, {
        cwd: repoPath,
        encoding: "buffer",
      }).toString("utf8");
    } catch {
      throw new Error(`File not found at ${this.ref}:${filePath}`);
    }

    // Binary detection (same heuristic as FileSystemRepositorySource)
    const sampleSize = Math.min(content.length, 8000);
    for (let i = 0; i < sampleSize; i++) {
      if (content.charCodeAt(i) === 0) {
        throw new Error("BINARY_FILE_DETECTED");
      }
    }

    return content.replace(/\u0000/g, "");
  }
}
