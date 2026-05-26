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
        symbolName,
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

  return chunks;
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
    symbolName,
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
      symbolName,
      kindLabel: `${kindLabel}-body`,
      exported,
      lineStart: sourceFile.getLineAndColumnAtPos(currentStart).line,
      lineEnd: sourceFile.getLineAndColumnAtPos(currentEnd).line,
    });

    currentText = "";
  };

  for (const bodyStmt of bodyStatements) {
    const stmtText = bodyStmt.getFullText();
    if (
      currentText.length + stmtText.length > opts.hardMaxChars &&
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

function findSplittableBody(stmt: Node): Node | undefined {
  // find the inner block of a function, method, or class
  if (Node.isFunctionDeclaration(stmt) || Node.isFunctionExpression(stmt)) {
    return stmt.getBody();
  }

  if (Node.isClassDeclaration(stmt)) {
    // for classes we treat the class body as a list of members
    // return the first block shaped descendant or undefined to fall back to text splitting
    return undefined;
  }

  if (Node.isVariableStatement(stmt)) {
    // look for arrow fn or fn expression initializer
    const decls = stmt.getDeclarations();
    for (const d of decls) {
      const init = d.getInitializer();
      if (
        (init && Node.isArrowFunction(init)) ||
        Node.isFunctionExpression(init)
      )
        return init.getBody as Node;
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
        symbolName,
        kindLabel: `${kindLabel}-partial`,
        exported,
        lineStart: currentStartLine,
        lineEnd: lineCursor,
      });
      current = "";
      currentStartLine = lineCursor + 1;
    }
    current += (current.length > 0 ? "\n" : "") + line;
    lineCursor++;
  }

  if (current.trim().length > 0) {
    chunks.push({
      content: current,
      symbolName,
      kindLabel: `${kindLabel}-partial`,
      exported,
      lineStart: currentStartLine,
      lineEnd: lineCursor,
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
        (buffer.content.length <= opts.targetMinChars &&
          wouldMergeSize <= opts.targetMaxChars)) &&
      wouldMergeSize <= opts.hardMaxChars;

    if (shouldMerge) {
      buffer = {
        content: buffer.content + "\n\n" + chunk.content,
        symbolName: buffer.symbolName ?? chunk.symbolName,
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

  if (buffer != null) merged.push(buffer);
  return merged;
}

// symbol / kind extraction
function getSymbolName(stmt: Node): string | undefined {
  if (Node.isFunctionDeclaration(stmt)) return stmt.getName();
  if (Node.isClassDeclaration(stmt)) return stmt.getName();

  if (Node.isInterfaceDeclaration(stmt)) return stmt.getName();

  if (Node.isTypeAliasDeclaration(stmt)) return stmt.getName();

  if (Node.isEnumDeclaration(stmt)) return stmt.getName();
  if (Node.isVariableDeclaration(stmt)) {
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
  return false;
}

// output mapping
function toContextChunk(raw: RawChunk, source: ContextSource): ContextChunk {
  const metadata: ContextChunk["metadata"] = {
    symbols: raw.symbolName ? [raw.symbolName] : [],
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
