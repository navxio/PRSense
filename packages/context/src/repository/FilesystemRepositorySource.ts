import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {
  RepositorySource,
  RepositoryIdentity,
  RepositoryRevision,
} from "./RepositorySource.js";

export class FileSystemRepositorySource implements RepositorySource {
  constructor(private readonly root: string) {}

  async listFiles(): Promise<string[]> {
    // Try authoritative git listing first
    try {
      const output = execSync("git ls-files", {
        cwd: this.root,
        encoding: "utf8",
      });

      return output
        .split("\n")
        .filter(Boolean)
        .map((relative) => path.join(this.root, relative));
    } catch {
      // Fallback: not a git repository
      return this.walkDirectory(this.root);
    }
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    async function walk(current: string) {
      const entries = await fs.readdir(current, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === ".git") continue;

        const fullPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await walk(dir);
    return files;
  }

  async readFile(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);

    // Detect binary via NULL byte
    const sampleSize = Math.min(buffer.length, 8000);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) {
        throw new Error("BINARY_FILE_DETECTED");
      }
    }

    // Convert to UTF-8 safely
    let content = buffer.toString("utf8");

    // Defensive: strip remaining NULL characters if any
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
}
