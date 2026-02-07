export type SlackCredentials =
  | {
      kind: "bot";
      available: true;
      botTokenPresent: boolean;
    }
  | {
      available: false;
    };
