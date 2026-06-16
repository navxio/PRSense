// packages/core/src/repository/identity.ts
export type RepositoryProvider =
  | "filesystem"
  | "github"
  | "gitlab"
  | "codeberg";

export type RepositoryIdentity = {
  provider: RepositoryProvider;
  id: string;
};
