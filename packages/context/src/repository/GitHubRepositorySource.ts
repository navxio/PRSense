import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  GitBackedRepositorySource,
  RepositoryIdentity,
  RepositoryRevision,
} from "./GitBackedRepositorySource.js";
import { FileSystemRepositorySource } from "./FilesystemRepositorySource.js";

export class GitHubRepositorySource implements GitBackedRepositorySource {
  private tempDir: string | null = null;
  private fsSource: FileSystemRepositorySource | null = null;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly token?: string,
  ) {}

  private async ensureCloned(): Promise<void> {
    if (this.fsSource) return;

    const baseTemp = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-"));

    const cloneUrl = this.token
      ? `https://${this.token}@github.com/${this.owner}/${this.repo}.git`
      : `https://github.com/${this.owner}/${this.repo}.git`;

    execSync(`git clone --depth 1 ${cloneUrl} ${baseTemp}`, {
      stdio: "ignore",
    });

    this.tempDir = baseTemp;
    this.fsSource = new FileSystemRepositorySource(baseTemp);
  }

  async listFiles(): Promise<string[]> {
    await this.ensureCloned();
    return this.fsSource!.listFiles();
  }

  async readFile(filePath: string): Promise<string> {
    await this.ensureCloned();
    return this.fsSource!.readFile(filePath);
  }

  async getRevision(): Promise<RepositoryRevision> {
    await this.ensureCloned();
    return this.fsSource!.getRevision();
  }

  getRepositoryIdentity(): RepositoryIdentity {
    return {
      provider: "github",
      id: `${this.owner}/${this.repo}`,
    };
  }
  getLocalPath(): string {
    if (!this.tempDir) {
      throw new Error("Repository not cloned yet");
    }
    return this.tempDir;
  }
}
