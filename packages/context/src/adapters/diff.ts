// packages/context/src/adapters/diff.ts
import type { UnifiedDiff, ContextChunk } from "@prsense/core";
import { randomUUID } from "node:crypto";

export function chunksFromDiff(diff: UnifiedDiff): ContextChunk[] {
  return diff.files.map((file) => ({
    id: randomUUID(),
    source: {
      kind: "file",
      path: file.path,
    },
    content: file.patch,
    metadata: {
      path: file.path,
    },
  }));
}
