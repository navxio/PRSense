// packages/context/src/repository/HttpsCloneRepositorySource.ts
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { GitBackedRepositorySource } from "./GitBackedRepositorySource.js";
import { FileSystemRepositorySource } from "./FilesystemRepositorySource.js";
import { RepositoryIdentity, RepositoryRevision } from "@prsense/core";

export type CloneSpec = {
  provider: RepositoryIdentity["provider"];
  host: string; // e.g. "github.com"
  owner: string; // owner / namespace / group
  repo: string;
  token?: string;
};

/**
 * Clones an HTTPS git repository into a temp dir once, lazily, then delegates
 * all reads to a FileSystemRepositorySource. Replaces the per-provider
 * GitHub/GitLab/Codeberg sources, which differed only in the clone URL.
 */
export class HttpsCloneRepositorySource implements GitBackedRepositorySource {
  private tempDir: string | null = null;
  private fsSource: FileSystemRepositorySource | null = null;

  constructor(private readonly spec: CloneSpec) {}

  private cloneUrl(): string {
    const { host, owner, repo, token } = this.spec;
    const auth = token ? `${token}@` : "";
    return `https://${auth}${host}/${owner}/${repo}.git`;
  }

  private async ensureCloned(): Promise<void> {
    if (this.fsSource) return;
    const baseTemp = await fs.mkdtemp(path.join(os.tmpdir(), "prsense-"));
    // execFileSync (not execSync) so the token in the URL is never exposed to
    // a shell and cannot be broken by special characters.
    execFileSync("git", ["clone", "--depth", "1", this.cloneUrl(), baseTemp], {
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
      provider: this.spec.provider,
      id: `${this.spec.owner}/${this.spec.repo}`,
    };
  }

  getLocalPath(): string {
    if (!this.tempDir) throw new Error("Repository not cloned yet");
    return this.tempDir;
  }
}

// Thin constructors preserving the old call sites.
export const githubRepositorySource = (
  owner: string,
  repo: string,
  token?: string,
) =>
  new HttpsCloneRepositorySource({
    provider: "github",
    host: "github.com",
    owner,
    repo,
    ...(token !== undefined && { token }),
  });

export const gitlabRepositorySource = (
  namespace: string,
  repo: string,
  token?: string,
) =>
  new HttpsCloneRepositorySource({
    provider: "gitlab",
    host: "gitlab.com",
    owner: namespace,
    repo,
    ...(token !== undefined && { token }),
  });

export const codebergRepositorySource = (
  owner: string,
  repo: string,
  token?: string,
  host = "codeberg.org",
) =>
  new HttpsCloneRepositorySource({
    provider: "codeberg",
    host,
    owner,
    repo,
    ...(token !== undefined && { token }),
  });
