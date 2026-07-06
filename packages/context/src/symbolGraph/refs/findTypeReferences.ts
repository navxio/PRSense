// packages/context/src/symbolGraph/refs/findTypeReferences.ts
import { Node, Project, SyntaxKind } from "ts-morph";
import type { TypeReferenceNode } from "ts-morph";
import { join } from "node:path";

/** Where a type name appears in a type position. */
export type TypeRefKind = "param" | "return" | "field";

export interface TypeRefHit {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  kind: TypeRefKind;
  isTest: boolean;
  enclosingStatement: Node;
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

  const decl = head.getSourceFile(join(workspaceRoot, declarationFile));
  const declNode = decl
    ?.getExportSymbols()
    .find((s) => s.getName() === symbolName)
    ?.getDeclarations()[0];
  const nameNode = declNode?.getFirstDescendantByKind(SyntaxKind.Identifier);
  if (!declNode || !nameNode) return [];

  const declSf = declNode.getSourceFile();
  const declStart = declNode.getStart();
  const declEnd = declNode.getEnd();

  const seen = new Set<string>();
  const hits: TypeRefHit[] = [];

  for (const ref of nameNode.findReferencesAsNodes()) {
    // Type usage only: resolve the enclosing TypeReference. The ref is
    // either its direct child (User) or nested in a QualifiedName (api.User).
    const typeRef = enclosingTypeRef(ref);
    if (!typeRef) continue; // value position (call, new, import) — not ours

    const sf = ref.getSourceFile();
    // Skip the changed type's own declaration node — but keep same-file
    // consumers (functions/fields in the decl file that use the type).
    if (
      sf === declSf &&
      ref.getStart() >= declStart &&
      ref.getEnd() <= declEnd
    ) {
      continue;
    }
    const rel = relative(workspaceRoot, sf.getFilePath());
    if (GENERATED.test(rel)) continue;

    const kind = classify(typeRef);
    if (!kind) continue;

    const lineStart = ref.getStartLineNumber();
    const key = `${rel}:${lineStart}:${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Member-first so fields ground on the property line; then signatures
    // (interface methods) so those ground on the full method, not the type.
    const enclosing =
      ref.getFirstAncestor(
        (a) => Node.isPropertyDeclaration(a) || Node.isPropertySignature(a),
      ) ??
      ref.getFirstAncestor(
        (a) =>
          Node.isMethodSignature(a) ||
          Node.isMethodDeclaration(a) ||
          Node.isCallSignatureDeclaration(a) ||
          Node.isConstructSignatureDeclaration(a),
      ) ??
      ref.getFirstAncestor((a) => Node.isStatement(a)) ??
      ref.getParentOrThrow();

    hits.push({
      filePath: rel,
      lineStart,
      lineEnd: enclosing.getEndLineNumber(),
      kind,
      isTest: TEST.test(rel),
      enclosingStatement: enclosing,
    });
  }

  return hits;
}

/**
 * Ascend through chained TypeReferences (e.g. Array<User>, Promise<User>) to
 * the outermost type node, then classify by its structural owner.
 */
function classify(typeRef: TypeReferenceNode): TypeRefKind | undefined {
  // Ascend through wrapping type nodes (Array<T>, Promise<T>, T[], unions)
  // to the outermost type node, then classify by its structural owner.
  let node: Node = typeRef;
  for (
    let parent = node.getParent();
    parent && Node.isTypeNode(parent);
    parent = node.getParent()
  ) {
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

/**
 * Resolve the TypeReference a reference identifier belongs to. Direct child
 * (User) or nested in a QualifiedName (api.User); anything else is not a
 * type position.
 */
function enclosingTypeRef(ref: Node): TypeReferenceNode | undefined {
  const parent = ref.getParent();
  if (Node.isTypeReference(parent)) return parent;
  if (Node.isQualifiedName(parent)) {
    return ref.getFirstAncestorByKind(SyntaxKind.TypeReference);
  }
  return undefined;
}
