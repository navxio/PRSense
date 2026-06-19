// packages/core/src/repository/target.ts
export type ClassifiedTarget =
  | {
      provider: "github";
      root: string;
      owner: string;
      repo: string;
      pr: string;
    }
  | {
      provider: "gitlab";
      root: string;
      group: string;
      project: string;
      mr: string;
    }
  | {
      provider: "codeberg";
      root: string;
      owner: string;
      repo: string;
      pr: string;
    }
  | { provider: "filesystem"; root: string };
