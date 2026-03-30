import {
  ResolvedConfig,
  ValidationIssue,
  CredentialContext,
} from "@prsense/config";
export function validateEffectiveIndexConfig(
  config: ResolvedConfig,
  credentials: CredentialContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  /* ------------------------------------------------- */
  /* Embeddings (CRITICAL for index)                   */
  /* ------------------------------------------------- */

  validateEmbeddingsConfig(config, credentials, issues);

  /* ------------------------------------------------- */
  /* Index runtime sanity (light, not structural)      */
  /* ------------------------------------------------- */

  validateIndexRuntimeConfig(config, issues);

  return issues;
}

function validateEmbeddingsConfig(
  config: ResolvedConfig,
  credentials: CredentialContext,
  issues: ValidationIssue[],
) {
  const { provider, model } = config.embeddings;

  const allowedProviders = ["ollama", "openai"];

  if (!allowedProviders.includes(provider)) {
    issues.push({
      level: "error",
      message: `Invalid embeddings provider: ${provider}`,
      path: "embeddings.provider",
    });
  }

  if (!model || model.trim() === "") {
    issues.push({
      level: "error",
      message: "Embeddings model must be provided",
      path: "embeddings.model",
    });
  }

  // Runtime dependency: credentials

  if (provider === "openai" && !credentials.openai?.available) {
    issues.push({
      level: "error",
      message:
        "OpenAI embeddings selected but PRSENSE_OPENAI_API_KEY is missing",
      path: "embeddings.provider",
    });
  }
}

function validateIndexRuntimeConfig(
  config: ResolvedConfig,
  issues: ValidationIssue[],
) {
  const { chunkSizeChars, chunkOverlapChars } = config.index;

  // These SHOULD already be valid, but we guard anyway
  // (defensive layer for CLI overrides)

  if (chunkSizeChars <= 0) {
    issues.push({
      level: "error",
      message: "chunkSizeChars must be > 0",
      path: "index.chunkSizeChars",
    });
  }

  if (chunkOverlapChars < 0) {
    issues.push({
      level: "error",
      message: "chunkOverlapChars must be >= 0",
      path: "index.chunkOverlapChars",
    });
  }

  if (chunkOverlapChars >= chunkSizeChars) {
    issues.push({
      level: "error",
      message: "chunkOverlapChars must be smaller than chunkSizeChars",
      path: "index.chunkOverlapChars",
    });
  }

  // Optional warning
  if (chunkOverlapChars === 0) {
    issues.push({
      level: "warning",
      message:
        "chunkOverlapChars is 0 — may reduce semantic continuity between chunks",
      path: "index.chunkOverlapChars",
    });
  }
}
