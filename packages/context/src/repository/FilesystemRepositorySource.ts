import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  RepositorySource,
  RepositoryIdentity,
  RepositoryRevision,
} from "./RepositorySource.js";

export class FileSystemRepositorySource implements RepositorySource {
  constructor(private readonly root: string) {}

  async listFiles(): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === ".git") continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await walk(this.root);

    return files;
  }

  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, "utf8");
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
