// packages/context/src/repository/CodebergRepositorySource.ts
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { GitBackedRepositorySource } from "./GitBackedRepositorySource.js";
import { RepositoryIdentity, RepositoryRevision } from "@prsense/core";
import { FileSystemRepositorySource } from "./FilesystemRepositorySource.js";

//PERF: can collapse this and GithubRepositorySource into
// into HttpsCloneRepositorySource
export class CodebergRepositorySource implements GitBackedRepositorySource {
  private tempDir: string | null = null;
  private fsSource: FileSystemRepositorySource | null = null;

  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly token?: string,
    private readonly host: string = "codeberg.org",
  ) {}

  private async ensureCloned(): Promise<void> {
    if (this.fsSource) return;
    const baseTemp = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-"));
    const cloneUrl = this.token
      ? `https://${this.token}@${this.host}/${this.owner}/${this.repo}.git`
      : `https://${this.host}/${this.owner}/${this.repo}.git`;
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
    return { provider: "codeberg", id: `${this.owner}/${this.repo}` };
  }

  getLocalPath(): string {
    if (!this.tempDir) throw new Error("Repository not cloned yet");
    return this.tempDir;
  }
}
