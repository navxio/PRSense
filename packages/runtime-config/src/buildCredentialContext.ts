// packages/runtime-config/src/buildCredentialContext.ts
import type { EnvConfig } from "@prsense/config";
import type { CredentialContext } from "./CredentialContext.js";

export function buildCredentialContext(env: EnvConfig): CredentialContext {
  return {
    /* ---------------- LLM ---------------- */

    openai: env.PRSENSE_OPENAI_API_KEY
      ? {
          available: true,
          apiKey: env.PRSENSE_OPENAI_API_KEY,
        }
      : { available: false },

    gemini: env.PRSENSE_GEMINI_API_KEY
      ? {
          available: true,
          apiKey: env.PRSENSE_GEMINI_API_KEY,
        }
      : { available: false },

    claude: env.PRSENSE_CLAUDE_API_KEY
      ? {
          available: true,
          apiKey: env.PRSENSE_CLAUDE_API_KEY,
        }
      : { available: false },

    /* ---------------- GitHub ---------------- */

    github:
      env.PRSENSE_GITHUB_TOKEN ||
      (env.PRSENSE_GITHUB_APP_ID &&
        env.PRSENSE_GITHUB_APP_PRIVATE_KEY &&
        env.PRSENSE_GITHUB_INSTALLATION_ID)
        ? {
            available: true,
            ...(env.PRSENSE_GITHUB_TOKEN
              ? {
                  mode: "token" as const,
                  token: env.PRSENSE_GITHUB_TOKEN,
                }
              : {
                  mode: "app" as const,
                  appId: env.PRSENSE_GITHUB_APP_ID,
                  privateKey: env.PRSENSE_GITHUB_APP_PRIVATE_KEY,
                  installationId: env.PRSENSE_GITHUB_INSTALLATION_ID,
                }),
            webhookSecret: env.PRSENSE_GITHUB_WEBHOOK_SECRET,
          }
        : { available: false },

    /* ---------------- GitLab ---------------- */

    gitlab: env.PRSENSE_GITLAB_TOKEN
      ? {
          available: true,
          token: env.PRSENSE_GITLAB_TOKEN,
          webhookSecret: env.PRSENSE_GITLAB_WEBHOOK_SECRET,
        }
      : { available: false },

    /* ---------------- Slack ---------------- */

    slack: env.PRSENSE_SLACK_BOT_TOKEN
      ? {
          available: true,
          botToken: env.PRSENSE_SLACK_BOT_TOKEN,
        }
      : { available: false },
  };
}
