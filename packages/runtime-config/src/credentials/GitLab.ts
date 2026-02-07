export type GitLabCredentials =
  | {
      kind: "token";
      available: true;
      tokenPresent: boolean;
    }
  | {
      available: false;
    };
