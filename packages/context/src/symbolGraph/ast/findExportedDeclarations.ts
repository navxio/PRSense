// packages/context/src/symbolGraph/ast/findExportedDeclarations.ts
import ts from "typescript";

export type DeclarationKind =
  | "function"
  | "class"
  | "interface"
  | "typeAlias"
  | "constExport"
  | "defaultExport";

export type ExportedDeclaration = {
  name: string;
  kind: DeclarationKind;
  startLine: number; // 1-indexed, inclusive
  endLine: number;
};

export function findExportedDeclarations(
  filePath: string,
  content: string,
): ExportedDeclaration[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const out: ExportedDeclaration[] = [];
  for (const stmt of sourceFile.statements) {
    extract(stmt, sourceFile, out);
  }
  return out;
}

function extract(
  stmt: ts.Statement,
  sf: ts.SourceFile,
  out: ExportedDeclaration[],
): void {
  // `export default <expr>` and `export = <expr>`
  if (ts.isExportAssignment(stmt)) {
    if (stmt.isExportEquals) return; // CommonJS-style; out of scope
    const expr = stmt.expression;
    const name = ts.isIdentifier(expr) ? expr.text : "default";
    out.push({
      name,
      kind: "defaultExport",
      ...lineRange(stmt, sf),
    });
    return;
  }

  if (!hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) return;
  const isDefault = hasModifier(stmt, ts.SyntaxKind.DefaultKeyword);

  if (ts.isFunctionDeclaration(stmt) && stmt.name) {
    out.push({
      name: stmt.name.text,
      kind: isDefault ? "defaultExport" : "function",
      ...lineRange(stmt, sf),
    });
  } else if (ts.isClassDeclaration(stmt) && stmt.name) {
    out.push({
      name: stmt.name.text,
      kind: isDefault ? "defaultExport" : "class",
      ...lineRange(stmt, sf),
    });
  } else if (ts.isInterfaceDeclaration(stmt)) {
    out.push({
      name: stmt.name.text,
      kind: "interface",
      ...lineRange(stmt, sf),
    });
  } else if (ts.isTypeAliasDeclaration(stmt)) {
    out.push({
      name: stmt.name.text,
      kind: "typeAlias",
      ...lineRange(stmt, sf),
    });
  } else if (ts.isVariableStatement(stmt)) {
    // `export const a = 1, b = 2;` — one entry per identifier binding.
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        out.push({
          name: decl.name.text,
          kind: "constExport",
          ...lineRange(stmt, sf),
        });
      }
      // skip destructuring patterns: `export const { a } = …`
    }
  }
  // skip: enum, namespace, re-exports (ExportDeclaration), ambient
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const mods = ts.getModifiers(node);
  return mods?.some((m) => m.kind === kind) ?? false;
}

function lineRange(
  node: ts.Node,
  sf: ts.SourceFile,
): { startLine: number; endLine: number } {
  // getStart() skips leading trivia (comments/JSDoc). Using full span (incl.
  // body) is intentional: the gate is permissive — body-only changes will
  // be filtered out later by the structural signature diff (step 6).
  return {
    startLine: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    endLine: sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
  };
}
