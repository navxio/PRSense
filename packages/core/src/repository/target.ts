// packages/core/src/repository/target.ts
export type ClassifiedTarget =
  | {
      provider: "github";
      kind: "pr";
      root: string;
      owner: string;
      repo: string;
      pr: string;
    }
  | {
      provider: "github";
      kind: "repo";
      root: string;
      owner: string;
      repo: string;
    }
  | {
      provider: "gitlab";
      kind: "mr";
      root: string;
      group: string;
      project: string;
      mr: string;
    }
  | {
      provider: "gitlab";
      kind: "repo";
      root: string;
      group: string;
      project: string;
    }
  | {
      provider: "codeberg";
      kind: "pr";
      root: string;
      owner: string;
      repo: string;
      pr: string;
    }
  | {
      provider: "codeberg";
      kind: "repo";
      root: string;
      owner: string;
      repo: string;
    }
  | { provider: "filesystem"; root: string };
