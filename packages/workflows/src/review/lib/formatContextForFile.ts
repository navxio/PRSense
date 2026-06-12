// packages/workflows/src/review/lib/formatContextForFile.ts
import type { ContextChunk } from "@prsense/core";

const MAX_CHARS_PER_FILE = 8000;

export function formatContextForFile(chunks: ContextChunk[]): string {
  if (chunks.length === 0) return "";

  let acc = "";
  for (const c of chunks) {
    if (c.source.kind !== "file") continue; // non-file sources unsupported for now
    const block = `// ${c.source.path}\n${c.content}\n\n`;
    if (acc.length + block.length > MAX_CHARS_PER_FILE) break;
    acc += block;
  }
  return acc;
}
