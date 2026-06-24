// packages/context/src/symbolGraph/refs/findReferences.ts
import { Node, type Project, type Symbol } from "ts-morph";
import { findSymbolInProject } from "../sig/findSymbolInProject.js";

export type ReferenceHit = {
  filePath: string; // workspace-relative
  isTest: boolean;
  enclosingStatement: Node; // the snippet unit (step 8 renders this)
  lineStart: number;
  lineEnd: number;
};

export function findReferences(opts: {
  head: Project;
  declarationFile: string; // workspace-relative
  symbolName: string;
  isDefaultExport: boolean;
  workspaceRoot: string; // absolute, for relativization
}): ReferenceHit[] {
  const headSymbol = findSymbolInProject(
    opts.head,
    opts.declarationFile,
    opts.symbolName,
    opts.isDefaultExport,
  );
  if (!headSymbol) return [];

  const referenceNodes = safeFindReferences(headSymbol);

  const hits: ReferenceHit[] = [];
  const seen = new Set<string>();

  for (const node of referenceNodes) {
    const sourceFile = node.getSourceFile();
    const absPath = sourceFile.getFilePath();

    const relPath = toWorkspaceRelative(absPath, opts.workspaceRoot);
    if (!relPath) continue;
    if (relPath === opts.declarationFile) continue; // self-file
    if (isGeneratedPath(relPath)) continue; // dist, build, .d.ts

    if (!isCallSite(node)) continue;

    const stmt = enclosingStatement(node);
    if (!stmt) continue;

    const lineStart = sourceFile.getLineAndColumnAtPos(stmt.getStart()).line;
    const lineEnd = sourceFile.getLineAndColumnAtPos(stmt.getEnd()).line;

    // Dedupe by file+line. Multiple references on one statement
    // (e.g. `foo(foo())`) collapse into one rendered snippet.
    const key = `${relPath}:${lineStart}`;
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({
      filePath: relPath,
      isTest: isTestFile(relPath),
      enclosingStatement: stmt,
      lineStart,
      lineEnd,
    });
  }

  return hits;
}

function safeFindReferences(symbol: Symbol): Node[] {
  try {
    return symbol.getDeclarations()[0]
      ? findReferencesViaIdentifier(symbol)
      : [];
  } catch {
    return [];
  }
}

// findReferencesAsNodes lives on identifier nodes, not symbols.
// Walk to the declaration's name node and ask from there.
function findReferencesViaIdentifier(symbol: Symbol): Node[] {
  const decl = symbol.getDeclarations()[0];
  if (!decl) return [];

  const nameNode =
    (Node.hasName(decl) ? decl.getNameNode() : undefined) ??
    (Node.isVariableDeclaration(decl) ? decl.getNameNode() : undefined);

  if (!nameNode || !Node.isIdentifier(nameNode)) return [];
  return nameNode.findReferencesAsNodes();
}

function isCallSite(referenceNode: Node): boolean {
  // The reference node IS the identifier at the use site. Walk up to
  // see whether it's the callee of a CallExpression or NewExpression.
  const parent = referenceNode.getParent();
  if (!parent) return false;
  if (
    Node.isCallExpression(parent) &&
    parent.getExpression() === referenceNode
  ) {
    return true;
  }
  if (
    Node.isNewExpression(parent) &&
    parent.getExpression() === referenceNode
  ) {
    return true;
  }
  // Property access: foo.bar — the identifier is `foo`, parent is
  // PropertyAccessExpression. Check grandparent for the call.
  if (
    Node.isPropertyAccessExpression(parent) &&
    parent.getExpression() === referenceNode
  ) {
    const grand = parent.getParent();
    if (
      grand &&
      (Node.isCallExpression(grand) || Node.isNewExpression(grand))
    ) {
      return grand.getExpression() === parent;
    }
  }
  return false;
}

function enclosingStatement(node: Node): Node | undefined {
  let current: Node | undefined = node;
  while (current) {
    if (Node.isStatement(current)) return current;
    current = current.getParent();
  }
  return undefined;
}

function toWorkspaceRelative(
  absPath: string,
  workspaceRoot: string,
): string | undefined {
  const normalizedRoot = workspaceRoot.endsWith("/")
    ? workspaceRoot
    : workspaceRoot + "/";
  if (!absPath.startsWith(normalizedRoot)) return undefined;
  return absPath.slice(normalizedRoot.length);
}

function isGeneratedPath(relPath: string): boolean {
  if (relPath.endsWith(".d.ts")) return true;
  const segments = relPath.split("/");
  return segments.some((s) => s === "dist" || s === "build" || s === "out");
}

function isTestFile(relPath: string): boolean {
  if (/\.(test|spec)\.[mc]?[jt]sx?$/.test(relPath)) return true;
  return relPath.split("/").some((s) => s === "__tests__");
}
