import fs from "node:fs";
import path from "node:path";

import { ContextRetriever } from "./ContextRetriever.js";
import { ContextChunk } from "../model/ContextChunk.js";
import { ContextSource } from "../model/ContextSource.js";
import { chunkCode } from "../chunking/chunkCode.js";

const MAX_CHUNKS = 5;

export const filesystemRetriever: ContextRetriever = async (query) => {
  const touchedFiles = query.diff.files.map((f) => f.path);

  const chunks: ContextChunk[] = [];

  for (const relativePath of touchedFiles) {
    if (chunks.length >= MAX_CHUNKS) break;

    const absPath = path.resolve(process.cwd(), relativePath);

    if (!fs.existsSync(absPath)) continue;
    if (!fs.statSync(absPath).isFile()) continue;

    const content = fs.readFileSync(absPath, "utf8");

    const source: ContextSource = {
      kind: "code",
      path: relativePath,
    };

    const fileChunks = chunkCode(content, source, {
      maxLinesPerChunk: 40,
    });

    for (const chunk of fileChunks) {
      chunks.push(chunk);
      if (chunks.length >= MAX_CHUNKS) break;
    }
  }

  return {
    chunks,
    stats: {
      totalChunks: chunks.length,
      truncated: chunks.length >= MAX_CHUNKS,
    },
  };
};
