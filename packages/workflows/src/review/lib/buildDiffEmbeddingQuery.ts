// packages/workflows/src/review/buildDiffEmbeddingQuery.ts
import type { UnifiedDiff } from "@prsense/core";

export function buildDiffEmbeddingQuery(params: {
  diff: UnifiedDiff;
  title?: string;
  description?: string;
  maxChars?: number;
}): string {
  const { diff, title, description, maxChars = 4000 } = params;

  const parts: string[] = [];

  // -------------------------------------------------
  // PR Intent
  // -------------------------------------------------

  if (title) {
    parts.push(`PR Title: ${title}`);
  }

  if (description) {
    parts.push(`PR Description: ${description}`);
  }

  // -------------------------------------------------
  // Changed Files (strong retrieval anchor)
  // -------------------------------------------------

  parts.push("Changed Files:");

  for (const file of diff.files.slice(0, 50)) {
    parts.push(file.path);
  }

  // -------------------------------------------------
  // Meaningful Code Changes
  // -------------------------------------------------

  parts.push("\nChanged Code:");

  for (const file of diff.files) {
    parts.push(`File: ${file.path}`);

    const lines = file.patch.split("\n");

    for (const line of lines) {
      // Only meaningful changes
      if (line.startsWith("+") && !line.startsWith("+++")) {
        parts.push(line.slice(1));
      }

      if (line.startsWith("-") && !line.startsWith("---")) {
        parts.push(line.slice(1));
      }
    }
  }

  let query = parts.join("\n");

  if (query.length > maxChars) {
    query = query.slice(0, maxChars);
  }

  return query;
}
