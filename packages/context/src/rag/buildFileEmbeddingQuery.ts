// packages/context/src/rag/buildFileEmbeddingQuery.ts
import type { DiffFile } from "@prsense/core";

export function buildFileEmbeddingQuery(params: {
  file: DiffFile;
  maxChars?: number;
  prMetadata?: { title?: string };
}): string {
  const { file, prMetadata, maxChars = 4000 } = params;

  const headerParts: string[] = [];
  if (prMetadata?.title) headerParts.push(`PR title: ${prMetadata.title}`);
  headerParts.push(`File: ${file.path}`);
  headerParts.push("Changes:");
  const header = headerParts.join("\n");

  const body =
    file.hunks && file.hunks.length > 0
      ? file.hunks.map((h) => h.content).join("\n")
      : file.patch;

  const budget = maxChars - header.length - 1;
  const truncatedBody = body.length > budget ? body.slice(0, budget) : body;

  return `${header}\n${truncatedBody}`;
}
