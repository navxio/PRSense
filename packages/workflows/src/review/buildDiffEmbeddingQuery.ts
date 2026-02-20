import type { UnifiedDiff } from "@prsense/core";

export function buildDiffEmbeddingQuery(
  diff: UnifiedDiff,
  maxChars = 4000,
): string {
  const parts: string[] = [];

  for (const file of diff.files) {
    parts.push(`File: ${file.path}`);

    const lines = file.patch.split("\n");

    for (const line of lines) {
      // Only embed meaningful changes
      if (line.startsWith("+") && !line.startsWith("+++")) {
        parts.push(line.slice(1));
      }

      // Optional: include removed lines
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
