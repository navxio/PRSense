// packages/core/src/context/ContextSource.ts

export type ContextSource =
  | {
      kind: "file";
      path: string;
    }
  | {
      kind: "symbol";
      name: string;
      path?: string;
    }
  | {
      kind: "commit";
      sha: string;
    }
  | {
      kind: "doc";
      id: string;
    }
  | {
      kind: "manual";
      label: string;
    };
