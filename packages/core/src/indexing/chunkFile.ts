// packages/engine/src/indexing/chunkFile.ts
import { Chunk } from "@prsense/context";

export const chunkText = (params: {
  repoId: Chunk["repo"];
  path: string;
  kind: Chunk["kind"];
  language?: Chunk["language"];
  content: string;
  chunkSize: number;
  chunkOverlap: number;
}): Chunk[] => {
  const lines = params.content.split("\n");
  const chunks: Chunk[] = [];

  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + params.chunkSize, lines.length);
    const text = lines.slice(start, end).join("\n");

    chunks.push({
      id: `${params.repoId.name}:${params.path}:${start}-${end}`,
      repo: params.repoId,
      path: params.path,
      kind: params.kind,
      content: text,
      lineStart: start + 1,
      lineEnd: end,
      ...(params.language !== undefined && {
        language: params.language,
      }),
    });

    start = end - params.chunkOverlap;
    if (start < 0) start = 0;
  }

  return chunks;
};
