// packages/context/src/adapters/filesystem.ts
import fs from "node:fs/promises";
import path from "node:path";
import type { ContextChunk } from "@prsense/core";
import type { Chunker } from "../chunking/types.js";

export async function chunksFromFilesystem({
  root,
  files,
  chunker,
}: {
  root: string;
  files: string[];
  chunker: Chunker;
}): Promise<ContextChunk[]> {
  const chunks: ContextChunk[] = [];

  for (const file of files) {
    const fullPath = path.join(root, file);
    const content = await fs.readFile(fullPath, "utf8");

    chunks.push(
      ...chunker.chunk({
        content,
        source: {
          kind: "file",
          path: file,
        },
      }),
    );
  }

  return chunks;
}
