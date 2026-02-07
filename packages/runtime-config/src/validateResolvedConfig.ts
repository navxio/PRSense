// packages/runtime-config/src/validateResolvedConfig.ts

import type { ResolvedConfig } from "./ResolvedConfig.js";

export type ConfigValidationIssue = {
  level: "error" | "warning";
  message: string;
  path?: string; // e.g. "llm.provider"
};

export type ConfigValidationResult = {
  valid: boolean;
  issues: ConfigValidationIssue[];
};

export function validateResolvedConfig(
  config: ResolvedConfig,
): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  // Example: delivery vs credentials
  if (config.delivery.vcs === "github") {
    // check required env vars are *present in config context*
    // (not raw env access here)
  }

  if (config.context.maxChunks <= 0) {
    issues.push({
      level: "error",
      message: "context.maxChunks must be > 0",
      path: "context.maxChunks",
    });
  }

  return {
    valid: !issues.some((i) => i.level === "error"),
    issues,
  };
}
