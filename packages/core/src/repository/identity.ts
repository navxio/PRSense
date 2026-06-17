// packages/core/src/repository/identity.ts
export const REPOSITORY_PROVIDERS = [
  "filesystem",
  "github",
  "gitlab",
  "codeberg",
] as const;

export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number];

export type RepositoryIdentity = {
  provider: RepositoryProvider;
  id: string;
};

export type RepositoryRevision = {
  commitSha: string;
  defaultBranch?: string;
};
