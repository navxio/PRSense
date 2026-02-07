export type GitHubCredentials =
  | {
      kind: "app";
      available: true;
      appIdPresent: boolean;
      privateKeyPresent: boolean;
      installationIdPresent: boolean;
    }
  | {
      kind: "token";
      available: true;
      tokenPresent: boolean;
    }
  | {
      available: false;
    };
