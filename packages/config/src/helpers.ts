// packages/config/src/helpers.ts
import type { ValidationIssue } from "./types.js";

export function issuesFor(
  issues: ValidationIssue[],
  prefixes: string[],
): ValidationIssue[] {
  return issues.filter((i) => prefixes.some((p) => i.path?.startsWith(p)));
}

export const REVIEW_PREFIXES = ["llm.", "review.", "context.", "embeddings."];
export const INDEX_PREFIXES = ["embeddings.", "index."];
