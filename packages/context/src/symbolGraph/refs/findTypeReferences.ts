// packages/context/src/symbolGraph/refs/findTypeReferences.ts
import { Node, Project, SyntaxKind } from "ts-morph";
import type { TypeReferenceNode } from "ts-morph";

/** Where a type name appears in a type position. */
export type TypeRefKind = "param" | "return" | "field";

export interface TypeRefHit {
  filePath: string;
  lineStart: number;
  kind: TypeRefKind;
  isTest: boolean;
}

export interface FindTypeReferencesParams {
  head: Project;
  declarationFile: string;
  /** Name of the exported type/interface/class whose shape changed. */
  symbolName: string;
  workspaceRoot: string;
}

const GENERATED = /(^|\/)(dist|build|out|coverage)\//;
const TEST = /(\.test\.|\.spec\.|\/__tests__\/)/;

/**
 * Collects declared-type reference sites for `symbolName`: parameter types,
 * return types, and field types. The value pass (findReferences) drops these;
 * this is its complement. Head-only — whether the type actually changed is
 * gated upstream by signature diffing on the declaration itself.
 */
export function findTypeReferences(
  params: FindTypeReferencesParams,
): TypeRefHit[] {
  const { head, declarationFile, symbolName, workspaceRoot } = params;

  const decl = head.getSourceFile(declarationFile);
  const nameNode = decl
    ?.getExportSymbols()
    .find((s) => s.getName() === symbolName)
    ?.getDeclarations()[0]
    ?.getFirstDescendantByKind(SyntaxKind.Identifier);
  if (!nameNode) return [];

  const seen = new Set<string>();
  const hits: TypeRefHit[] = [];

  for (const ref of nameNode.findReferencesAsNodes()) {
    // Type usage only: the identifier's parent is a TypeReference node.
    const typeRef = ref.getParentIfKind(SyntaxKind.TypeReference);
    if (!typeRef) continue; // value position (call, new, import) — not ours

    const sf = ref.getSourceFile();
    const rel = relative(workspaceRoot, sf.getFilePath());
    if (rel === declarationFile) continue; // self
    if (GENERATED.test(rel)) continue;

    const kind = classify(typeRef);
    if (!kind) continue;

    const lineStart = ref.getStartLineNumber();
    const key = `${rel}:${lineStart}:${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({ filePath: rel, lineStart, kind, isTest: TEST.test(rel) });
  }

  return hits;
}

/**
 * Ascend through chained TypeReferences (e.g. Array<User>, Promise<User>) to
 * the outermost type node, then classify by its structural owner.
 */
function classify(typeRef: TypeReferenceNode): TypeRefKind | undefined {
  let node: Node = typeRef;
  while (Node.isTypeReference(node.getParent() ?? node)) {
    const parent = node.getParent();
    if (!parent || !Node.isTypeReference(parent)) break;
    node = parent;
  }

  const owner = node.getParent();
  if (!owner) return undefined;

  if (Node.isParameterDeclaration(owner)) return "param";
  if (Node.isPropertyDeclaration(owner) || Node.isPropertySignature(owner)) {
    return "field";
  }
  // Return position: the type node is the declared return type of a callable.
  if (
    Node.isFunctionDeclaration(owner) ||
    Node.isMethodDeclaration(owner) ||
    Node.isMethodSignature(owner) ||
    Node.isArrowFunction(owner) ||
    Node.isFunctionExpression(owner)
  ) {
    return owner.getReturnTypeNode() === node ? "return" : undefined;
  }
  return undefined;
}

function relative(root: string, abs: string): string {
  return abs.startsWith(root + "/") ? abs.slice(root.length + 1) : abs;
}
