// packages/context/src/symbolGraph/sig/diffSignatures.ts
import type { Project } from "ts-morph";
import type { ExportedDeclaration } from "../ast/findExportedDeclarations.js";
import { findSymbolInProject } from "./findSymbolInProject.js";
import { canonicalSignature } from "./canonicalSignature.js";

export type TriggeredCandidate = ExportedDeclaration & {
  filePath: string;
};

/**
 * Identifies candidates whose canonical signature changed between
 * base and HEAD.
 *
 * Skipped for v1:
 * - Added exports (no base symbol): no migration bug class to surface.
 * - Removed exports (no HEAD symbol): can't query HEAD references for
 *   something that doesn't exist there.
 */
export function diffSignatures(opts: {
  candidatesByFile: Map<string, ExportedDeclaration[]>;
  head: Project;
  base: Project;
}): TriggeredCandidate[] {
  const out: TriggeredCandidate[] = [];
  for (const [filePath, candidates] of opts.candidatesByFile) {
    for (const candidate of candidates) {
      const isDefault = candidate.kind === "defaultExport";
      const headSym = findSymbolInProject(
        opts.head,
        filePath,
        candidate.name,
        isDefault,
      );
      const baseSym = findSymbolInProject(
        opts.base,
        filePath,
        candidate.name,
        isDefault,
      );

      if (!headSym || !baseSym) continue;

      if (canonicalSignature(headSym) !== canonicalSignature(baseSym)) {
        out.push({ ...candidate, filePath });
      }
    }
  }
  return out;
}
