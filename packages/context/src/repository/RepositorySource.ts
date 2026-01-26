// packages/context/src/repository/RepositorySource.ts
export interface RepositorySource {
  /** Human-readable identity */
  describe(): Promise<{
    name: string;
    revision: string; // commit hash, branch, tag, etc
  }>;

  /** Enumerate indexable files */
  listFiles(): AsyncIterable<{
    path: string;
    language?: string;
  }>;

  /** Read file contents */
  readFile(path: string): Promise<string>;
}
