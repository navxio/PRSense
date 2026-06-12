// packages/core/src/repository/identity.ts
export type RepositoryProvider = "filesystem" | "github" | "gitlab";

export type RepositoryIdentity = {
  provider: RepositoryProvider;
  id: string;
};
