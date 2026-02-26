export type CredentialContext = {
  /* ---------------- LLM ---------------- */

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

  /* ---------------- GitHub ---------------- */

  github?: {
    available: boolean;
    mode?: "token" | "app";
    token?: string;
    appId?: string;
    privateKey?: string;
    installationId?: string;
    webhookSecret?: string;
  };

  /* ---------------- GitLab ---------------- */

  gitlab?: {
    available: boolean;
    token?: string;
    webhookSecret?: string;
  };

  /* ---------------- Slack ---------------- */

  slack?: {
    available: boolean;
    botToken?: string;
  };
};
