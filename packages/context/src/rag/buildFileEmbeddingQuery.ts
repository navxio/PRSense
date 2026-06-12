// packages/context/src/rag/buildFileEmbeddingQuery.ts
import type { DiffFile } from "@prsense/core";

export function buildFileEmbeddingQuery(params: {
  file: DiffFile;
  prMetadata?: { title?: string; description?: string };
}): string {
  const { file, prMetadata } = params;
  const parts: string[] = [];

  if (prMetadata?.title) parts.push(`PR title: ${prMetadata.title}`);
  parts.push(`File: ${file.path}`);

  if (file.hunks && file.hunks.length > 0) {
    parts.push("Changes:");
    for (const hunk of file.hunks) parts.push(hunk.content);
  } else {
    parts.push("Changes:");
    parts.push(file.patch);
  }

  return parts.join("\n");
}
