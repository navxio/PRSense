// packages/runtime-config/src/buildCredentialContext.ts

import type { EnvConfig } from "@prsense/config";
import type { CredentialContext } from "./CredentialContext.js";
import type {
  GitHubCredentials,
  GitLabCredentials,
  OpenAICredentials,
  SlackCredentials,
} from "./credentials/index.js";

export function buildCredentialContext(
  env: EnvConfig,
  opts: {
    mode: "saas" | "self-hosted";
  },
): CredentialContext {
  const { mode } = opts;

  /* ------------------------------------------------- */
  /* GitHub                                            */
  /* ------------------------------------------------- */

  let github: GitHubCredentials | undefined;

  if (mode === "saas") {
    // SaaS always uses GitHub App (owned by PRSense)
    github = {
      kind: "app",
      available: true,
      appIdPresent: true,
      privateKeyPresent: true,
      installationIdPresent: true,
    };
  } else {
    // self-hosted: GitHub App OR token
    if (env.PRSENSE_GITHUB_APP_ID || env.PRSENSE_GITHUB_APP_PRIVATE_KEY) {
      github = {
        kind: "app",
        available: true,
        appIdPresent: Boolean(env.PRSENSE_GITHUB_APP_ID),
        privateKeyPresent: Boolean(env.PRSENSE_GITHUB_APP_PRIVATE_KEY),
        installationIdPresent: Boolean(env.PRSENSE_GITHUB_INSTALLATION_ID),
      };
    } else if (env.PRSENSE_GITHUB_TOKEN) {
      github = {
        kind: "token",
        available: true,
        tokenPresent: true,
      };
    } else {
      github = { available: false };
    }
  }

  /* ------------------------------------------------- */
  /* GitLab                                            */
  /* ------------------------------------------------- */

  let gitlab: GitLabCredentials | undefined;

  if (mode === "saas") {
    // SaaS token is managed internally
    gitlab = {
      kind: "token",
      available: true,
      tokenPresent: true,
    };
  } else {
    gitlab = env.PRSENSE_GITLAB_TOKEN
      ? {
          kind: "token",
          available: true,
          tokenPresent: true,
        }
      : { available: false };
  }

  /* ------------------------------------------------- */
  /* OpenAI                                           */
  /* ------------------------------------------------- */

  let openai: OpenAICredentials | undefined;

  if (mode === "saas") {
    openai = {
      kind: "api-key",
      available: true,
      apiKeyPresent: true,
    };
  } else {
    openai = env.PRSENSE_OPENAI_API_KEY
      ? {
          kind: "api-key",
          available: true,
          apiKeyPresent: true,
        }
      : { available: false };
  }

  /* ------------------------------------------------- */
  /* Slack                                            */
  /* ------------------------------------------------- */

  let slack: SlackCredentials | undefined;

  if (mode === "saas") {
    slack = {
      kind: "bot",
      available: true,
      botTokenPresent: true,
    };
  } else {
    slack = env.PRSENSE_SLACK_BOT_TOKEN
      ? {
          kind: "bot",
          available: true,
          botTokenPresent: true,
        }
      : { available: false };
  }

  /* ------------------------------------------------- */
  /* Final context                                     */
  /* ------------------------------------------------- */

  return {
    mode,
    github,
    gitlab,
    openai,
    slack,
  };
}
