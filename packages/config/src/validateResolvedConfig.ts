// packages/runtime-config/src/validateResolvedConfig.ts

import type { ResolvedConfig } from "./types.js";

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
  /* Review                                            */
  /* ------------------------------------------------- */

  if (
    config.review.confidenceThreshold < 0 ||
    config.review.confidenceThreshold > 1
  ) {
    issues.push({
      level: "error",
      message: "review.confidenceThreshold must be between 0 and 1",
      path: "review.confidenceThreshold",
    });
  }

  if (config.review.maxSignals <= 0) {
    issues.push({
      level: "error",
      message: "review.maxSignals must be greater than 0",
      path: "review.maxSignals",
    });
  }

  /* ------------------------------------------------- */
  /* Index                                             */
  /* ------------------------------------------------- */

  if (config.index.chunkSizeChars <= 0) {
    issues.push({
      level: "error",
      message: "index.chunkSizeChars must be greater than 0",
      path: "index.chunkSizeChars",
    });
  }

  if (config.index.chunkOverlapChars < 0) {
    issues.push({
      level: "error",
      message: "index.chunkOverlapChars cannot be negative",
      path: "index.chunkOverlapChars",
    });
  }

  if (config.index.chunkOverlapChars >= config.index.chunkSizeChars) {
    issues.push({
      level: "error",
      message: "index.chunkOverlapChars must be smaller than chunkSizeChars",
      path: "index.chunkOverlapChars",
    });
  }

  /* ------------------------------------------------- */
  /* Daemon-specific Domain Rules                      */
  /* ------------------------------------------------- */

  if (config.mode === "daemon") {
    if (!config.delivery) {
      issues.push({
        level: "error",
        message: "Daemon mode requires delivery configuration",
        path: "delivery",
      });
    }
  }

  return {
    valid: !issues.some((i) => i.level === "error"),
    issues,
  };
}
