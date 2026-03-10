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

const OTHER_CHANNELS = ["jira", "slack"] as const;
export type OtherChannel = (typeof OTHER_CHANNELS)[number];
export type PlatformDeliveryChannel = "github" | "gitlab";

export type Delivery = {
  platform: PlatformDeliveryChannel;
  other: readonly OtherChannel[];
};

type BaseResolvedConfig = {
  repository: {
    root: string;
    provider: "github" | "gitlab" | "filesystem";
  };

  index: {
    chunkSizeChars: number;
    chunkOverlapChars: number;
    maxFileSizeBytes: number;
  };

  review: {
    confidenceThreshold: number;
    maxSignals: number;
  };

  context: {
    maxChunks: number;
  };

  llm: {
    provider: "ollama" | "openai" | "google" | "anthropic";
    model: string;
    temperature: number;
  };

  embeddings: {
    provider: "ollama" | "openai";
    model: string;
  };

  database: {
    url: string;
    mode: "bundled" | "external";
  };
};

export type CliResolvedConfig = BaseResolvedConfig & {
  mode: "cli";
};

export type DaemonResolvedConfig = BaseResolvedConfig & {
  mode: "daemon";

  delivery: Delivery;
};

export type ResolvedConfig = CliResolvedConfig | DaemonResolvedConfig;

export type ValidationIssue = {
  severity: "error" | "warning";
  message: string;
};

export type RuntimeEnvironment = {
  config: ResolvedConfig;
  credentials: CredentialContext;
  issues: ValidationIssue[];
};
