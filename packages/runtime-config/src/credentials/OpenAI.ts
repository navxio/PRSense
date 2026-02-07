export type OpenAICredentials =
  | {
      kind: "api-key";
      available: true;
      apiKeyPresent: boolean;
    }
  | {
      available: false;
    };
