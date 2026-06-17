// packages/config/src/validateEnvironment.ts
import type {
  ResolvedConfig,
  CredentialContext,
  ValidationIssue,
} from "./types.js";
import { validateCredentials } from "./validateCredentials.js";

export function validateEnvironment(
  config: ResolvedConfig,
  credentials: CredentialContext,
): ValidationIssue[] {
  // Structural validation already happened in ResolvedConfigSchema.parse.
  // Runtime credential validation is all that's left.
  return validateCredentials(config, credentials);
}
