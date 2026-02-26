export type CredentialContext = {
  openai?: {
    available: boolean;
    apiKey?: string;
  };

  gemini?: {
    available: boolean;
    apiKey?: string;
  };

  claude?: {
    available: boolean;
    apiKey?: string;
  };

  github?: {
    available: boolean;
    mode: "token" | "app";
    token?: string;
    appId?: string;
    privateKey?: string;
    installationId?: string;
  };

  gitlab?: {
    available: boolean;
    token?: string;
  };

  slack?: {
    available: boolean;
    botToken?: string;
  };
};
