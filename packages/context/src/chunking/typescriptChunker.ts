// packages/context/src/chunking/typescriptChunker.ts
import {
  Project,
  Node,
  SyntaxKind,
  type SourceFile,
  type Block,
} from "ts-morph";
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
  targetMaxChars: 1500, // try to not emit chunks larger than this
  hardMinChars: 100, // force-merge below this
  hardMaxChars: 2000, // force-split above this
};

// Node kinds we treat as chunkable top-level declarations
const CHUNKABLE_KINDS = new Set<SyntaxKind>([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.ClassDeclaration,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.VariableStatement,
  SyntaxKind.ExportAssignment,
  SyntaxKind.ExpressionStatement,
]);

const SKIPPABLE_KINDS = new Set<SyntaxKind>([
  SyntaxKind.ImportDeclaration,
  SyntaxKind.ExportDeclaration,
]);

type RawChunk = {
  content: string;
  symbolNames: string[];
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
function extractRawChunks(
  sourceFile: SourceFile,
  opts: TypeScriptChunkerOptions,
): RawChunk[] {
  const chunks: RawChunk[] = [];

  for (const stmt of sourceFile.getStatements()) {
    const kind = stmt.getKind();
    if (SKIPPABLE_KINDS.has(kind)) continue;
    if (!CHUNKABLE_KINDS.has(kind)) continue;

    // include leading jsdoc / comments profusely
    const fullStart = stmt.getStart(/* include jsdoc comments */ true);
    const end = stmt.getEnd();
    const text = sourceFile.getFullText().slice(fullStart, end);
    const lineStart = sourceFile.getLineAndColumnAtPos(fullStart).line;
    const lineEnd = sourceFile.getLineAndColumnAtPos(end).line;

    const symbolName = getSymbolName(stmt);
    const kindLabel = getKindLabel(stmt);
    const exported = isExported(stmt);

    const text_trimmed = text.trim();
    if (text_trimmed.length === 0) continue;

    if (text.length <= opts.hardMaxChars) {
      chunks.push({
        content: text,
        symbolNames: symbolName ? [symbolName] : [],
        kindLabel,
        exported,
        lineStart,
        lineEnd,
      });
    } else {
      // split large bodies at statement boundaries
      const subChunks = subSplitLargeDeclaration(
        stmt,
        sourceFile,
        opts,
        symbolName,
        kindLabel,
        exported,
      );
      chunks.push(...subChunks);
    }
  }

  // Belt-and-suspenders: enforce hardMaxChars on every emitted chunk.
  // The splitting logic above should already keep chunks within bounds, but
  // if any code path produces an oversized chunk, truncate it here rather
  // than letting the embedding step reject the entire indexing run.
  const TRUNCATION_MARKER = "\n// [truncated]";
  return chunks.map((c) => {
    if (c.content.length <= opts.hardMaxChars) return c;
    const sliceLength = opts.hardMaxChars - TRUNCATION_MARKER.length;
    return {
      ...c,
      content: c.content.slice(0, sliceLength) + TRUNCATION_MARKER,
    };
  });
}

// splitting large declarations
function subSplitLargeDeclaration(
  stmt: Node,
  sourceFile: SourceFile,
  opts: TypeScriptChunkerOptions,
  symbolName: string | undefined,
  kindLabel: string,
  exported: boolean,
): RawChunk[] {
  // find the body block and split
  // for larger nodes fall back to splitting the raw text at line boundaries near targetMaxChars

  const body = findSplittableBody(stmt);

  if (!body) {
    return splitTextAtLineBoundaries(
      sourceFile.getFullText().slice(stmt.getStart(true), stmt.getEnd()),
      opts,
      symbolName,
      kindLabel,
      exported,
      sourceFile.getLineAndColumnAtPos(stmt.getStart(true)).line,
    );
  }

  const bodyStatements = body.getStatements();
  if (bodyStatements.length === 0) {
    // empty body but huge declaration
    return splitTextAtLineBoundaries(
      sourceFile.getFullText().slice(stmt.getStart(true), stmt.getEnd()),
      opts,
      symbolName,
      kindLabel,
      exported,
      sourceFile.getLineAndColumnAtPos(stmt.getStart(true)).line,
    );
  }

  // build a "header" chunk (declaration signature + opening brace)
  const declStart = stmt.getStart(true);
  const bodyStart = body.getStart();
  const headerText = sourceFile.getFullText().slice(declStart, bodyStart + 1);

  const chunks: RawChunk[] = [];

  chunks.push({
    content: headerText + "\n // ...",
    symbolNames: symbolName ? [symbolName] : [],
    kindLabel: `${kindLabel}-header`,
    exported,
    lineStart: sourceFile.getLineAndColumnAtPos(declStart).line,
    lineEnd: sourceFile.getLineAndColumnAtPos(bodyStart).line,
  });

  // Group body statements into chunks of ~targetMaxChars
  let currentText = "";
  let currentStart = bodyStatements[0]!.getStart();
  let currentEnd = currentStart;

  const flush = () => {
    if (currentText.trim().length === 0) return;

    chunks.push({
      content: `// inside ${symbolName ?? kindLabel}\n${currentText}`,
      symbolNames: symbolName ? [symbolName] : [],
      kindLabel: `${kindLabel}-body`,
      exported,
      lineStart: sourceFile.getLineAndColumnAtPos(currentStart).line,
      lineEnd: sourceFile.getLineAndColumnAtPos(currentEnd).line,
    });

    currentText = "";
  };

  for (const bodyStmt of bodyStatements) {
    const stmtText = bodyStmt.getFullText();

    if (stmtText.length > opts.hardMaxChars) {
      // Flush whatever we've accumulated, then split this enormous statement
      // at line boundaries.
      flush();
      const stmtStart = bodyStmt.getStart();
      const lineStart = sourceFile.getLineAndColumnAtPos(stmtStart).line;
      const subChunks = splitTextAtLineBoundaries(
        stmtText,
        opts,
        symbolName,
        kindLabel,
        exported,
        lineStart,
      );
      chunks.push(...subChunks);
      currentStart = bodyStmt.getEnd();
      currentEnd = currentStart;
      continue;
    }

    if (
      currentText.length + stmtText.length > opts.targetMaxChars &&
      currentText.length > 0
    ) {
      flush();
      currentStart = bodyStmt.getStart();
    }
    currentText += stmtText;
    currentEnd = bodyStmt.getEnd();
  }
  flush();
  return chunks;
}

function findSplittableBody(stmt: Node): Block | undefined {
  if (Node.isFunctionDeclaration(stmt) || Node.isFunctionExpression(stmt)) {
    const body = stmt.getBody();
    return body && Node.isBlock(body) ? body : undefined;
  }

  if (Node.isClassDeclaration(stmt)) {
    return undefined;
  }

  if (Node.isVariableStatement(stmt)) {
    const decls = stmt.getDeclarations();
    for (const d of decls) {
      const init = d.getInitializer();
      if (
        init &&
        (Node.isArrowFunction(init) || Node.isFunctionExpression(init))
      ) {
        const body = init.getBody();
        return Node.isBlock(body) ? body : undefined;
      }
    }
  }

  return undefined;
}

function splitTextAtLineBoundaries(
  text: string,
  opts: TypeScriptChunkerOptions,
  symbolName: string | undefined,
  kindLabel: string,
  exported: boolean,
  startLine: number,
): RawChunk[] {
  const lines = text.split("\n");
  const chunks: RawChunk[] = [];

  let current = "";
  let lineCursor = startLine;
  let currentStartLine = startLine;

  for (const line of lines) {
    if (
      current.length + line.length + 1 > opts.targetMaxChars &&
      current.length > 0
    ) {
      chunks.push({
        content: current,
        symbolNames: symbolName ? [symbolName] : [],
        kindLabel: `${kindLabel}-partial`,
        exported,
        lineStart: currentStartLine,
        lineEnd: lineCursor - 1,
      });
      current = "";
      currentStartLine = lineCursor;
    }
    current += (current.length > 0 ? "\n" : "") + line;
    lineCursor++;
  }

  if (current.trim().length > 0) {
    chunks.push({
      content: current,
      symbolNames: symbolName ? [symbolName] : [],
      kindLabel: `${kindLabel}-partial`,
      exported,
      lineStart: currentStartLine,
      lineEnd: lineCursor - 1,
    });
  }

  return chunks;
}

// handle small siblings by merging
function mergeSmallSiblings(
  chunks: RawChunk[],
  opts: TypeScriptChunkerOptions,
): RawChunk[] {
  if (chunks.length === 0) return chunks;

  const merged: RawChunk[] = [];
  let buffer: RawChunk | null = null;

  for (const chunk of chunks) {
    if (buffer === null) {
      buffer = chunk;
      continue;
    }

    const wouldMergeSize = buffer.content.length + chunk.content.length;

    // merge if either is below hard min or if buffer is below target min
    // and the merged size stays within target max
    //
    const shouldMerge =
      (buffer.content.length < opts.hardMinChars ||
        chunk.content.length < opts.hardMinChars ||
        (buffer.content.length < opts.targetMinChars &&
          wouldMergeSize <= opts.targetMaxChars)) &&
      wouldMergeSize <= opts.hardMaxChars;

    if (shouldMerge) {
      buffer = {
        content: buffer.content + "\n\n" + chunk.content,
        symbolNames: [...buffer.symbolNames, ...chunk.symbolNames],
        kindLabel:
          buffer.kindLabel === chunk.kindLabel ? buffer.kindLabel : "mixed",
        exported: buffer.exported || chunk.exported,
        lineStart: buffer.lineStart,
        lineEnd: chunk.lineEnd,
      };
    } else {
      merged.push(buffer);
      buffer = chunk;
    }
  }

  if (buffer !== null) merged.push(buffer);
  return merged;
}

// symbol / kind extraction
function getSymbolName(stmt: Node): string | undefined {
  if (Node.isFunctionDeclaration(stmt)) return stmt.getName();
  if (Node.isClassDeclaration(stmt)) return stmt.getName();

  if (Node.isInterfaceDeclaration(stmt)) return stmt.getName();

  if (Node.isTypeAliasDeclaration(stmt)) return stmt.getName();

  if (Node.isEnumDeclaration(stmt)) return stmt.getName();
  if (Node.isVariableStatement(stmt)) {
    const decls = stmt.getDeclarations();
    const first = decls[0];
    if (first) return first.getName();
  }
  if (Node.isExportAssignment(stmt)) return "default";
  return undefined;
}

function getKindLabel(stmt: Node): string {
  const kind = stmt.getKind();

  switch (kind) {
    case SyntaxKind.FunctionDeclaration:
      return "function";
    case SyntaxKind.ClassDeclaration:
      return "class";
    case SyntaxKind.InterfaceDeclaration:
      return "interface";
    case SyntaxKind.TypeAliasDeclaration:
      return "type";
    case SyntaxKind.EnumDeclaration:
      return "enum";
    case SyntaxKind.VariableStatement:
      return "variable";
    case SyntaxKind.ExportAssignment:
      return "default-export";
    case SyntaxKind.ExpressionStatement:
      return "expression";
    default:
      return "unknown";
  }
}

function isExported(stmt: Node): boolean {
  if (
    Node.isFunctionDeclaration(stmt) ||
    Node.isClassDeclaration(stmt) ||
    Node.isInterfaceDeclaration(stmt) ||
    Node.isTypeAliasDeclaration(stmt) ||
    Node.isEnumDeclaration(stmt) ||
    Node.isVariableStatement(stmt)
  ) {
    return stmt.isExported();
  }
  if (Node.isExportAssignment(stmt)) return true;
  return false;
}

// output mapping
function toContextChunk(raw: RawChunk, source: ContextSource): ContextChunk {
  const metadata: ContextChunk["metadata"] = {
    symbols: raw.symbolNames,
    language: "typescript",
    lineStart: raw.lineStart,
    lineEnd: raw.lineEnd,
    kind: "code",
    // extra fields under the index signature
    symbolKind: raw.kindLabel,
    exported: raw.exported,
  };

  return {
    id: randomUUID(),
    source,
    content: raw.content,
    metadata,
  };
}

function singleChunkFallback(
  content: string,
  source: ContextSource,
): ContextChunk {
  return {
    id: randomUUID(),
    source,
    content,
    metadata: {
      symbols: [],
      language: "typescript",
      kind: "code",
    },
  };
}
