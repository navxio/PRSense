export type IndexMetadata = {
  repository: {
    provider: "filesystem" | "github" | "gitlab";
    id: string; // e.g. absolute path OR owner/repo
    defaultBranch?: string;
  };

  revision: {
    commitSha: string;
  };

  embedding: {
    provider: string;
    model: string;
  };

  chunking: {
    strategy: string;
    version: number;
  };

  prsenseVersion: string;

  createdAt: string; // ISO string
};
