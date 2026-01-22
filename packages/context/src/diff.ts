import { UnifiedDiff, DiffFile } from "@prsense/core";

//TODO: add docs
export function parseUnifiedDiff(diffText: string): UnifiedDiff {
  const files: DiffFile[] = [];

  // split by file markers
  const parts = diffText.split(/^diff --git /m).slice(1);

  for (const part of parts) {
    const lines = part.split("\n");
    const header = lines[0];

    if (!header) continue;

    // example: a/src/foo.ts b/src/foo.ts
    const match = header.match(/a\/(.+?) b\/(.+)/);
    if (!match || !match[2]) continue;

    const filePath = match[2];

    files.push({
      path: filePath,
      patch: "diff --git " + part,
    });
  }

  return { files };
}
