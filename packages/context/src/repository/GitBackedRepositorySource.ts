// packages/context/src/repository/RepositorySource.ts

export type RepositoryIdentity = {
  provider: "filesystem" | "github" | "gitlab";
  id: string;
};

export type RepositoryRevision = {
  commitSha: string;
  defaultBranch?: string;
};

export interface GitBackedRepositorySource {
  listFiles(): Promise<string[]>;
  /** Read file contents */
  readFile(path: string): Promise<string>;

  /**
   * Returns the canonical revision identifier for this repository.
   * For git-backed repos, this is the current commit SHA.
   */
  getRevision(): Promise<{
    commitSha: string;
    defaultBranch?: string;
  }>;

  /**
   * Unique identifier for this repository.
   * Example:
   *   filesystem:/abs/path
   *   github:owner/repo
   */
  getRepositoryIdentity(): {
    provider: "filesystem" | "github" | "gitlab";
    id: string;
  };

  getLocalPath(): string;
}
