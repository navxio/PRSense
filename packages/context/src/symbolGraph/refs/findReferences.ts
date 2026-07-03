// packages/context/src/symbolGraph/refs/findReferences.ts
import { Node, type Project, type Symbol } from "ts-morph";
import { findSymbolInProject } from "../sig/findSymbolInProject.js";
import { compareHeritage, type MemberBreak } from "../sig/compareHeritage.js";

type RefKind = "call" | "heritage";

export type ReferenceHit = {
  filePath: string;
  isTest: boolean;
  enclosingStatement: Node;
  lineStart: number;
  lineEnd: number;
  refKind: RefKind;
  breaks?: MemberBreak[] | undefined; // heritage only
};

export function findReferences(opts: {
  head: Project;
  base: Project; // NEW: heritage compare needs X@base
  declarationFile: string;
  symbolName: string;
  isDefaultExport: boolean;
  workspaceRoot: string;
}): ReferenceHit[] {
  const headSymbol = findSymbolInProject(
    opts.head,
    opts.declarationFile,
    opts.symbolName,
    opts.isDefaultExport,
  );
  if (!headSymbol) return [];

  const baseSymbol = findSymbolInProject(
    opts.base,
    opts.declarationFile,
    opts.symbolName,
    opts.isDefaultExport,
  );

  const referenceNodes = safeFindReferences(headSymbol);

  const hits: ReferenceHit[] = [];
  const seen = new Set<string>();

  for (const node of referenceNodes) {
    const sourceFile = node.getSourceFile();
    const absPath = sourceFile.getFilePath();

    const relPath = toWorkspaceRelative(absPath, opts.workspaceRoot);
    if (!relPath) continue;
    if (relPath === opts.declarationFile) continue;
    if (isGeneratedPath(relPath)) continue;

    const refKind = classifyReference(node);
    if (!refKind) continue;

    let breaks: MemberBreak[] | undefined;
    if (refKind === "heritage") {
      if (!baseSymbol) continue; // no base shape to diff against
      const implementer = resolveImplementer(node);
      if (!implementer) continue;
      breaks = compareHeritage({
        base: baseSymbol,
        head: headSymbol,
        implementer,
      });
      if (breaks.length === 0) continue; // compare-first: no break, no snippet
    }

    const stmt = enclosingStatement(node);
    if (!stmt) continue;

    const lineStart = sourceFile.getLineAndColumnAtPos(stmt.getStart()).line;
    const lineEnd = sourceFile.getLineAndColumnAtPos(stmt.getEnd()).line;

    const key = `${relPath}:${lineStart}`;
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({
      filePath: relPath,
      isTest: isTestFile(relPath),
      enclosingStatement: stmt,
      lineStart,
      lineEnd,
      refKind,
      breaks,
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
  const parent = referenceNode.getParent();
  if (!parent) return false;

  // Direct call: foo() / new Foo()
  if (
    (Node.isCallExpression(parent) || Node.isNewExpression(parent)) &&
    parent.getExpression() === referenceNode
  ) {
    return true;
  }

  // Property access. Two sub-cases:
  //   (a) `foo.bar` where foo is what we're tracking: ref node = foo (LHS)
  //   (b) `foo.bar` where bar is what we're tracking: ref node = bar (name)
  if (Node.isPropertyAccessExpression(parent)) {
    const grand = parent.getParent();
    if (!grand) return false;
    const isCall = Node.isCallExpression(grand) || Node.isNewExpression(grand);
    if (!isCall || grand.getExpression() !== parent) return false;
    // Accept either side of the dot.
    return (
      parent.getExpression() === referenceNode ||
      parent.getNameNode() === referenceNode
    );
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

function classifyReference(node: Node): RefKind | null {
  if (isCallSite(node)) return "call";
  if (isHeritageRef(node)) return "heritage";
  return null;
}

function isHeritageRef(node: Node): boolean {
  const parent = node.getParent();
  if (!parent || !Node.isExpressionWithTypeArguments(parent)) return false;
  return Node.isHeritageClause(parent.getParent());
}

function resolveImplementer(node: Node): Symbol | undefined {
  let current: Node | undefined = node;
  while (current) {
    if (
      Node.isClassDeclaration(current) ||
      Node.isInterfaceDeclaration(current)
    ) {
      return current.getSymbol();
    }
    current = current.getParent();
  }
  return undefined;
}
