export type ContextSource =
  | { kind: "code"; path: string }
  | { kind: "doc"; path: string }
  | { kind: "test"; path: string }
  | { kind: "commit"; sha: string }
  | { kind: "config"; path: string };
