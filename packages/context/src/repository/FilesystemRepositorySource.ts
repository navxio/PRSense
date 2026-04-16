//packages/context/src/repository/FileSystemRepositorySource.ts
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  GitBackedRepositorySource,
  RepositoryIdentity,
  RepositoryRevision,
} from "./GitBackedRepositorySource.js";

export class FileSystemRepositorySource implements GitBackedRepositorySource {
  private readonly root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async listFiles(): Promise<string[]> {
    try {
      const output = execSync(
        "git -c core.quotepath=false ls-files -z --cached --others --exclude-standard",
        { cwd: this.root },
      );

      const candidates = output.toString("utf8").split("\0").filter(Boolean);

      const files: string[] = [];

      for (const filePath of candidates) {
        try {
          const absolutePath = path.resolve(this.root, filePath);
          const stat = await fs.stat(absolutePath);

          if (stat.isFile()) {
            files.push(filePath);
          }
        } catch {
          // ignore broken symlinks or transient paths
        }
      }

      return files;
    } catch {
      return this.walkDirectory(this.root);
    }
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const root = this.root;

    async function walk(current: string) {
      const entries = await fs.readdir(current, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === ".git") continue;

        const fullPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(path.relative(root, fullPath));
        }
      }
    }

    await walk(dir);
    return files;
  }

  async readFile(filePath: string): Promise<string> {
    const root = this.root;
    const absolutePath = path.resolve(root, filePath);

    // SECURITY CHECK
    if (absolutePath !== root && !absolutePath.startsWith(root + path.sep)) {
      throw new Error("PATH_OUTSIDE_REPOSITORY");
    }

    const stat = await fs.stat(absolutePath);

    if (!stat.isFile()) {
      throw new Error("NOT_A_FILE");
    }

    const buffer = await fs.readFile(absolutePath);

    // binary detection...
    const sampleSize = Math.min(buffer.length, 8000);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) {
        throw new Error("BINARY_FILE_DETECTED");
      }
    }

    let content = buffer.toString("utf8");
    content = content.replace(/\u0000/g, "");

    return content;
  }
  async getRevision(): Promise<RepositoryRevision> {
    try {
      const sha = execSync("git rev-parse HEAD", {
        cwd: this.root,
        encoding: "utf8",
      }).trim();

      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: this.root,
        encoding: "utf8",
      }).trim();

      return {
        commitSha: sha,
        defaultBranch: branch,
      };
    } catch {
      throw new Error(
        "Unable to resolve git revision. Ensure this is a git repository.",
      );
    }
  }

  getRepositoryIdentity(): RepositoryIdentity {
    return {
      provider: "filesystem",
      id: this.root,
    };
  }

  getLocalPath(): string {
    return this.root;
  }
}
