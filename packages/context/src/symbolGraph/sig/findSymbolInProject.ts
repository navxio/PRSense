// packages/context/src/symbolGraph/sig/findSymbolInProject.ts
import type { Project, Symbol } from "ts-morph";

export function findSymbolInProject(
  project: Project,
  relPath: string,
  name: string,
  isDefault: boolean,
): Symbol | undefined {
  // HEAD project: absolute disk paths. Base project: in-memory `/path`.
  // Both end with `/relPath` — suffix match is the unified lookup.
  const sourceFile = project
    .getSourceFiles()
    .find((sf) => sf.getFilePath().endsWith("/" + relPath));
  if (!sourceFile) return undefined;

  let symbol: Symbol | undefined;
  if (isDefault) {
    symbol = sourceFile.getDefaultExportSymbol();
  } else {
    symbol = sourceFile.getExportSymbols().find((s) => s.getName() === name);
  }
  if (!symbol) return undefined;

  // Resolve through alias indirection (re-exports, `export default foo`).
  try {
    return symbol.getAliasedSymbol() ?? symbol;
  } catch {
    return symbol;
  }
}
