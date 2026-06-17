import { RepositoryProvider } from "../repository/identity.js";
export type IndexMetadata = {
  repository: {
    provider: RepositoryProvider;
    id: string; // e.g. absolute path OR owner/repo
    defaultBranch?: string;
  };

  revision: {
    commitSha: string;
  };

  embedding: {
    provider: string;
    model: string;
    dimension: number;
  };

  chunking: {
    strategy: string;
    version: number;
  };

  prsenseVersion: string;

  createdAt: string; // ISO string
};
