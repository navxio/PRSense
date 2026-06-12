// packages/workflows/src/review/lib/formatContextForFile.ts
import type { ContextChunk } from "@prsense/core";

const MAX_CHARS_PER_FILE = 8000;

export function formatContextForFile(chunks: ContextChunk[]): string {
  if (chunks.length === 0) return "";

  let acc = "";
  for (const c of chunks) {
    const block = `// ${c.metadata.path}\n${c.content}\n\n`;
    if (acc.length + block.length > MAX_CHARS_PER_FILE) break;
    acc += block;
  }
  return acc;
}
