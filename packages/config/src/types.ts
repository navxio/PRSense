// packages/config/src/types.ts
export type {
  RuntimeConfig,
  ResolvedConfig,
  CliResolvedConfig,
  DaemonResolvedConfig,
} from "./schema.js";
import type { ResolvedConfig } from "./schema.js";

export type RuntimeMode = "cli" | "daemon";

export type ValidationIssue = {
  level: "error" | "warning";
  message: string;
  path?: string;
};

export type CredentialContext = {
  openai?: { available: boolean; apiKey?: string };
  google?: { available: boolean; apiKey?: string };
  anthropic?: { available: boolean; apiKey?: string };
  github?: {
    available: boolean;
    mode?: "token" | "app";
    token?: string;
    appId?: string;
    privateKey?: string;
    installationId?: string;
    webhookSecret?: string;
  };
  gitlab?: { available: boolean; token?: string; webhookSecret?: string };
  slack?: { available: boolean; botToken?: string };
  codeberg?: { available: boolean; token?: string; webhookSecret?: string };
};

export type RuntimeEnvironment = {
  config: ResolvedConfig;
  credentials: CredentialContext;
  issues: ValidationIssue[];
};
