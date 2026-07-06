// packages/context/src/symbolGraph/refs/rankAndCap.ts
import type { ReferenceHit } from "./findReferences.js";

export type RankedReferences = {
  shown: ReferenceHit[];
  total: number;
};

const DEFAULT_CAP = 5;

export function rankAndCap<
  T extends { filePath: string; lineStart: number },
>(opts: {
  references: T[];
  changedFiles: string[]; // workspace-relative- from the diff
  declarationFile: string; // for same-package comparison
  cap?: number;
}): { shown: T[]; total: number } {
  const cap = opts.cap ?? DEFAULT_CAP;
  const changedSet = new Set(opts.changedFiles);
  const declPkg = packageOf(opts.declarationFile);

  const scored = opts.references.map((ref) => {
    const sameThisPr = changedSet.has(ref.filePath);
    const samePkg = packageOf(ref.filePath) === declPkg;
    // Lower tier = higher priority. Ties broken by file path then line
    // for stable ordering across runs.
    const tier = sameThisPr ? 0 : samePkg ? 1 : 2;
    return { ref, tier };
  });

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.ref.filePath !== b.ref.filePath) {
      return a.ref.filePath < b.ref.filePath ? -1 : 1;
    }
    return a.ref.lineStart - b.ref.lineStart;
  });

  return {
    shown: scored.slice(0, cap).map((s) => s.ref),
    total: opts.references.length,
  };
}

// Best-effort package identity: the segment after "packages/" if any.
// Falls back to the top-level directory. Same-package callers should
// rank ahead of cross-package ones because the migration boundary
// usually starts inside the package owning the changed symbol.
function packageOf(relPath: string): string {
  const segs = relPath.split("/");
  const idx = segs.indexOf("packages");
  if (idx >= 0 && idx + 1 < segs.length) {
    return "packages/" + segs[idx + 1];
  }
  return segs[0] ?? "";
}
