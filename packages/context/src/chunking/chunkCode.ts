import { ContextChunk } from "../model/ContextChunk.js";
import { ContextSource } from "../model/ContextSource.js";
import crypto from "node:crypto";

type ChunkCodeOptions = {
  maxLinesPerChunk?: number;
};

export function chunkCode(
  content: string,
  source: ContextSource,
  options: ChunkCodeOptions = {},
): ContextChunk[] {
  const maxLines = options.maxLinesPerChunk ?? 40;

  const lines = content.split("\n");
  const chunks: ContextChunk[] = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    const slice = lines.slice(i, i + maxLines);
    const text = slice.join("\n");

    if (!text.trim()) continue;
    const metadata: ContextChunk["metadata"] = {
      lineStart: i + 1,
      lineEnd: i + slice.length,
    };

    if ("path" in source) {
      metadata.path = source.path;
    }
    chunks.push({
      id: crypto
        .createHash("sha1")
        .update(source.kind + JSON.stringify(source) + i)
        .digest("hex"),

      source,
      content: text,
      metadata,
    });
  }

  return chunks;
}
