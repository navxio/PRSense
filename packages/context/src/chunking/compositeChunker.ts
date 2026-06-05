// packages/context/src/chunking/compositeChunker.ts
import path from "node:path";

import type { Chunker } from "./types.js";

import { createCharChunker, type CharChunkerOptions } from "./charChunker.js";

import {
  createTypescriptChunker,
  type TypeScriptChunkerOptions,
} from "./typescriptChunker.js";

export type CompositeChunkerOptions = {
  char: CharChunkerOptions;
  typescript?: Partial<TypeScriptChunkerOptions>;
};

const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

export function createCompositeChunker(
  options: CompositeChunkerOptions,
): Chunker {
  const charChunker = createCharChunker(options.char);

  const tsChunker = createTypescriptChunker(options.typescript ?? {});

  return {
    chunk({ content, source }) {
      const filePath = source.kind === "file" ? source.path : "";
      const ext = path.extname(filePath).toLowerCase();
      if (TS_EXTENSIONS.has(ext)) {
        return tsChunker.chunk({ content, source });
      }
      return charChunker.chunk({ content, source });
    },
  };
}
