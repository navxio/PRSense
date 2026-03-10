import type {
  ResolvedConfig,
  CredentialContext,
  ValidationIssue,
} from "./types.js";

import { validateResolvedConfig } from "./validateResolvedConfig.js";
import { validateCredentials } from "./validateCredentials.js";

export function validateEnvironment(
  config: ResolvedConfig,
  credentials: CredentialContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...validateResolvedConfig(config).issues);
  issues.push(...validateCredentials(config, credentials));

  return issues;
}
