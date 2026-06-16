// packages/context/src/repository/RepositorySource.ts
import { RepositoryProvider, RepositoryRevision } from "@prsense/core";

export interface GitBackedRepositorySource {
  listFiles(): Promise<string[]>;
  /** Read file contents */
  readFile(path: string): Promise<string>;

  /**
   * Returns the canonical revision identifier for this repository.
   * For git-backed repos, this is the current commit SHA.
   */
  getRevision(): Promise<RepositoryRevision>;

  /**
   * Unique identifier for this repository.
   * Example:
   *   filesystem:/abs/path
   *   github:owner/repo
   */
  getRepositoryIdentity(): {
    provider: RepositoryProvider;
  };

  getLocalPath(): string;
}

export type RepositorySource = GitBackedRepositorySource;

