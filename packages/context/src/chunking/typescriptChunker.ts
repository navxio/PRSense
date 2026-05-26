// packages/context/src/chunking/typescriptChunker.ts
import { Project, Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { Chunker } from "./types.js";
import type { ContextChunk, ContextSource } from "@prsense/core";
import { randomUUID } from "node:crypto";

export type TypeScriptChunkerOptions = {
  targetMinChars: number;
  targetMaxChars: number;
  hardMinChars: number;
  hardMaxChars: number;
};

const DEFAULT_OPTIONS: TypeScriptChunkerOptions = {
  targetMinChars: 200, // try to not emit chunks smaller than this
  targetMaxChars: 2000, // try to not emit chunks larger than this
  hardMinChars: 100, // force-merge below this
  hardMaxChars: 3000, // force-split above this
};

// Node kinds we treat as chunkable top-level declarations
const CHUNKABLE_KINDS = new Set<SyntaxKind>([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.ClassDeclaration,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.VariableDeclaration,
  SyntaxKind.ExportAssignment,
  SyntaxKind.ExpressionStatement,
]);

const SKIPPABLE_KINDS = new Set<SyntaxKind>([
  SyntaxKind.ImportDeclaration,
  SyntaxKind.ExportDeclaration,
]);

type RawChunk = {
  content: string;
  symbolName: string | undefined;
  kindLabel: string;
  exported: boolean;
  lineStart: number;
  lineEnd: number;
};

export function createTypescriptChunker(
  options: Partial<TypeScriptChunkerOptions> = {},
): Chunker {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return {
    chunk({ content, source }) {
      const filePath = source.kind === "file" ? source.path : "unknown.ts";

      let project: Project;
      let sourceFile: SourceFile;

      try {
        project = new Project({
          useInMemoryFileSystem: true,
          compilerOptions: {
            allowJs: true,
            jsx: 4,
          },
        });
        sourceFile = project.createSourceFile(filePath, content, {
          overwrite: true,
        });
      } catch {
        // if parsing fails fall back to a single chunk
        // containing the whole file
        return [singleChunkFallback(content, source)];
      }

      const rawChunks = extractRawChunks(sourceFile, opts);
      const merged = mergeSmallSiblings(rawChunks, opts);

      return merged.map((raw) => toContextChunk(raw, source));
    },
  };
}

// Extraction
