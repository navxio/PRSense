// packages/runtime-config/src/validateResolvedConfig.ts

import type { ResolvedConfig } from "./ResolvedConfig.js";
import type { CredentialContext } from "./CredentialContext.js";

export type ConfigValidationIssue = {
  level: "error" | "warning";
  message: string;
  path?: string;
};

export type ConfigValidationResult = {
  valid: boolean;
  issues: ConfigValidationIssue[];
};

export function validateResolvedConfig(
  config: ResolvedConfig,
  creds: CredentialContext,
): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  /* ------------------------------------------------- */
  /* Context                                           */
  /* ------------------------------------------------- */

  if (config.context.maxChunks <= 0) {
    issues.push({
      level: "error",
      message: "context.maxChunks must be greater than 0",
      path: "context.maxChunks",
    });
  }

  /* ------------------------------------------------- */
  /* LLM                                               */
  /* ------------------------------------------------- */

  if (config.llm.provider === "openai") {
    const openai = creds.openai;

    if (!openai || !openai.available) {
      issues.push({
        level: "error",
        message:
          "OpenAI provider selected but no OpenAI credentials are configured",
        path: "llm.provider",
      });
    } else if (openai.kind === "api-key" && !openai.apiKeyPresent) {
      issues.push({
        level: "error",
        message: "OpenAI API key is missing or incomplete",
        path: "llm.provider",
      });
    }
  }

  /* ------------------------------------------------- */
  /* Embeddings                                        */
  /* ------------------------------------------------- */

  if (config.embeddings.provider === "openai") {
    const openai = creds.openai;

    if (!openai || !openai.available) {
      issues.push({
        level: "error",
        message:
          "OpenAI embeddings selected but no OpenAI credentials are configured",
        path: "embeddings.provider",
      });
    } else if (openai.kind === "api-key" && !openai.apiKeyPresent) {
      issues.push({
        level: "error",
        message: "OpenAI API key is missing or incomplete",
        path: "embeddings.provider",
      });
    }
  }

  /* ------------------------------------------------- */
  /* Delivery: VCS                                     */
  /* ------------------------------------------------- */

  if (config.delivery.vcs === "github") {
    const gh = creds.github;

    if (!gh || !gh.available) {
      issues.push({
        level: "error",
        message:
          "GitHub delivery is enabled but no GitHub credentials are configured",
        path: "delivery.vcs",
      });
    } else if (gh.kind === "app") {
      if (
        !gh.appIdPresent ||
        !gh.privateKeyPresent ||
        !gh.installationIdPresent
      ) {
        issues.push({
          level: "error",
          message:
            "GitHub App credentials are incomplete (appId, privateKey, or installationId missing)",
          path: "delivery.vcs",
        });
      }
    } else if (gh.kind === "token") {
      if (!gh.tokenPresent) {
        issues.push({
          level: "error",
          message: "GitHub token is missing",
          path: "delivery.vcs",
        });
      }
    }
  }

  if (config.delivery.vcs === "gitlab") {
    const gl = creds.gitlab;

    if (!gl || !gl.available) {
      issues.push({
        level: "error",
        message:
          "GitLab delivery is enabled but no GitLab credentials are configured",
        path: "delivery.vcs",
      });
    } else if (gl.kind === "token" && !gl.tokenPresent) {
      issues.push({
        level: "error",
        message: "GitLab token is missing",
        path: "delivery.vcs",
      });
    }
  }

  /* ------------------------------------------------- */
  /* Delivery: Other channels                          */
  /* ------------------------------------------------- */

  for (const channel of config.delivery.other) {
    if (channel === "slack") {
      const slack = creds.slack;

      if (!slack || !slack.available) {
        issues.push({
          level: "error",
          message:
            "Slack delivery is enabled but no Slack credentials are configured",
          path: "delivery.other",
        });
      } else if (slack.kind === "bot" && !slack.botTokenPresent) {
        issues.push({
          level: "error",
          message: "Slack bot token is missing",
          path: "delivery.other",
        });
      }
    }
  }

  /* ------------------------------------------------- */
  /* Final result                                      */
  /* ------------------------------------------------- */

  return {
    valid: !issues.some((i) => i.level === "error"),
    issues,
  };
}
