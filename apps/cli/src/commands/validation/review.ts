import {
  ResolvedConfig,
  CredentialContext,
  ValidationIssue,
} from "@prsense/config";

export function validateReviewEffectiveConfig(
  config: ResolvedConfig,
  credentials: CredentialContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  validateLLMConfig(config, credentials, issues);
  validateReviewConfig(config, issues);
  validateContextConfig(config, issues);

  return issues;
}

function validateLLMConfig(
  config: ResolvedConfig,
  credentials: CredentialContext,
  issues: ValidationIssue[],
) {
  const { provider, model, temperature } = config.llm;

  const allowedProviders = ["ollama", "openai", "google", "anthropic"];

  if (!allowedProviders.includes(provider)) {
    issues.push({
      level: "error",
      message: `Invalid LLM provider: ${provider}`,
      path: "llm.provider",
    });
  }

  if (!model || model.trim() === "") {
    issues.push({
      level: "error",
      message: "LLM model must be provided",
      path: "llm.model",
    });
  }

  if (temperature < 0 || temperature > 2) {
    issues.push({
      level: "error",
      message: "LLM temperature must be between 0 and 2",
      path: "llm.temperature",
    });
  }

  // Credential enforcement
  if (provider === "openai" && !credentials.openai?.available) {
    issues.push({
      level: "error",
      message: "OpenAI selected but PRSENSE_OPENAI_API_KEY is missing",
      path: "llm.provider",
    });
  }

  if (provider === "anthropic" && !credentials.anthropic?.available) {
    issues.push({
      level: "error",
      message: "Anthropic selected but PRSENSE_ANTHROPIC_API_KEY is missing",
      path: "llm.provider",
    });
  }

  if (provider === "google" && !credentials.google?.available) {
    issues.push({
      level: "error",
      message: "Google selected but PRSENSE_GOOGLE_API_KEY is missing",
      path: "llm.provider",
    });
  }
}

function validateReviewConfig(
  config: ResolvedConfig,
  issues: ValidationIssue[],
) {
  const { maxSignals, confidenceThreshold } = config.review;

  if (maxSignals <= 0) {
    issues.push({
      level: "error",
      message: "maxSignals must be > 0",
      path: "review.maxSignals",
    });
  }

  if (confidenceThreshold < 0 || confidenceThreshold > 1) {
    issues.push({
      level: "error",
      message: "confidenceThreshold must be between 0 and 1",
      path: "review.confidenceThreshold",
    });
  }
}

function validateContextConfig(
  config: ResolvedConfig,
  issues: ValidationIssue[],
) {
  const { maxChunks } = config.context;

  if (maxChunks < 0) {
    issues.push({
      level: "error",
      message: "maxChunks must be >= 0",
      path: "context.maxChunks",
    });
  }
}
