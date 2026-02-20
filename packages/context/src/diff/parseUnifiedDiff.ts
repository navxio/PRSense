// packages/context/src/diff/parseUnifiedDiff.ts

import type { UnifiedDiff, DiffFile } from "@prsense/core";

export function parseUnifiedDiff(diffText: string): UnifiedDiff {
  const files: DiffFile[] = [];

  if (!diffText.trim()) {
    return { files: [] };
  }

  const fileSections = diffText
    .split(/^diff --git /gm)
    .filter((s) => s.trim().length > 0);

  for (const section of fileSections) {
    const lines = section.split("\n");

    if (lines.length === 0) continue;

    const header = lines[0];
    if (!header) continue;

    // Try extracting path
    const match = header.match(/a\/(.+?) b\/(.+)/);

    let filePath = "unknown";

    if (match && match[2]) {
      filePath = match[2];
    }

    files.push({
      path: filePath,
      patch: section.trim(),
    });
  }

  return { files };
}
