// packages/runtime-config/src/validateCredentialContex.ts
import type { ResolvedConfig } from "./ResolvedConfig.js";
import type { CredentialContext } from "./CredentialContext.js";
import type { ConfigValidationIssue } from "./validateResolvedConfig.js";

export function validateCredentialContext(
  config: ResolvedConfig,
  creds: CredentialContext,
): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];

  /* ------------------------------------------------- */
  /* LLM Providers                                     */
  /* ------------------------------------------------- */

  switch (config.llm.provider) {
    case "openai":
      if (!creds.openai?.apiKey) {
        issues.push({
          level: "error",
          message: "OpenAI selected but API key is missing",
          path: "llm.provider",
        });
      }
      break;

    case "google":
      if (!creds.gemini?.apiKey) {
        issues.push({
          level: "error",
          message: "Gemini selected but API key is missing",
          path: "llm.provider",
        });
      }
      break;

    case "anthropic":
      if (!creds.claude?.apiKey) {
        issues.push({
          level: "error",
          message: "Claude selected but API key is missing",
          path: "llm.provider",
        });
      }
      break;
  }

  /* ------------------------------------------------- */
  /* Embeddings                                        */
  /* ------------------------------------------------- */

  if (config.embeddings.provider === "openai") {
    if (!creds.openai?.apiKey) {
      issues.push({
        level: "error",
        message: "OpenAI embeddings selected but API key missing",
        path: "embeddings.provider",
      });
    }
  }

  /* ------------------------------------------------- */
  /* Daemon Delivery Validation                        */
  /* ------------------------------------------------- */

  if (config.mode === "daemon") {
    if (config.delivery.platform === "github") {
      if (!creds.github?.available) {
        issues.push({
          level: "error",
          message: "GitHub delivery enabled but credentials missing",
          path: "delivery.platform",
        });
      }

      if (!creds.github?.webhookSecret) {
        issues.push({
          level: "error",
          message:
            "GitHub webhook secret missing (PRSENSE_GITHUB_WEBHOOK_SECRET)",
          path: "delivery.platform",
        });
      }
    }

    if (config.delivery.platform === "gitlab") {
      if (!creds.gitlab?.token) {
        issues.push({
          level: "error",
          message: "GitLab delivery enabled but token missing",
          path: "delivery.platform",
        });
      }

      if (!creds.gitlab?.webhookSecret) {
        issues.push({
          level: "error",
          message:
            "GitLab webhook secret missing (PRSENSE_GITLAB_WEBHOOK_SECRET)",
          path: "delivery.platform",
        });
      }
    }

    for (const channel of config.delivery.other) {
      if (channel === "slack" && !creds.slack?.botToken) {
        issues.push({
          level: "error",
          message: "Slack delivery enabled but bot token missing",
          path: "delivery.other",
        });
      }
    }
  }

  return issues;
}
