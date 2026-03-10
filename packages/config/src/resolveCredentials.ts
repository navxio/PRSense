// packages/runtime-config/src/buildCredentialContext.ts
import type { CredentialContext } from "./types.js";

export function resolveCredentials(): CredentialContext {
  return {
    /* ---------------- LLM ---------------- */

    openai: process.env.PRSENSE_OPENAI_API_KEY
      ? {
          available: true,
          apiKey: process.env.PRSENSE_OPENAI_API_KEY,
        }
      : { available: false },

    google: process.env.PRSENSE_GOOGLE_API_KEY
      ? {
          available: true,
          apiKey: process.env.PRSENSE_GOOGLE_API_KEY,
        }
      : { available: false },

    anthropic: process.env.PRSENSE_ANTHROPIC_API_KEY
      ? {
          available: true,
          apiKey: process.env.PRSENSE_ANTHROPIC_API_KEY,
        }
      : { available: false },

    /* ---------------- GitHub ---------------- */

    github: process.env.PRSENSE_GITHUB_TOKEN
      ? {
          available: true,
          mode: "token" as const,
          token: process.env.PRSENSE_GITHUB_TOKEN,
          ...(process.env.PRSENSE_GITHUB_WEBHOOK_SECRET
            ? { webhookSecret: process.env.PRSENSE_GITHUB_WEBHOOK_SECRET }
            : {}),
        }
      : process.env.PRSENSE_GITHUB_APP_ID &&
          process.env.PRSENSE_GITHUB_APP_PRIVATE_KEY &&
          process.env.PRSENSE_GITHUB_INSTALLATION_ID
        ? {
            available: true,
            mode: "app" as const,
            appId: process.env.PRSENSE_GITHUB_APP_ID,
            privateKey: process.env.PRSENSE_GITHUB_APP_PRIVATE_KEY,
            installationId: process.env.PRSENSE_GITHUB_INSTALLATION_ID,
            ...(process.env.PRSENSE_GITHUB_WEBHOOK_SECRET
              ? { webhookSecret: process.env.PRSENSE_GITHUB_WEBHOOK_SECRET }
              : {}),
          }
        : { available: false },

    /* ---------------- GitLab ---------------- */

    gitlab: process.env.PRSENSE_GITLAB_TOKEN
      ? {
          available: true,
          token: process.env.PRSENSE_GITLAB_TOKEN,
          ...(process.env.PRSENSE_GITLAB_WEBHOOK_SECRET
            ? { webhookSecret: process.env.PRSENSE_GITLAB_WEBHOOK_SECRET }
            : {}),
        }
      : { available: false },

    /* ---------------- Slack ---------------- */

    slack: process.env.PRSENSE_SLACK_BOT_TOKEN
      ? {
          available: true,
          botToken: process.env.PRSENSE_SLACK_BOT_TOKEN,
        }
      : { available: false },
  };
}
