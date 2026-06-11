// packages/context/src/repository/isIndexable.ts
/**
 * Directory or path segments that are never indexed at any depth.
 */
const DENY_SEGMENTS: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  "vendor",
  ".git",
  ".github",
  ".gitlab",
  ".husky",
  ".vscode",
  ".idea",
  ".next",
  ".turbo",
  ".cache",
]);

/**
 * Basename stems (case-insensitive) that mark a file as non-indexable
 * when the file has a doc-ish extension (see DOC_EXTS).
 *
 * Matches `LICENSE`, `LICENSE.md`, `LICENSE-MIT`, `CHANGELOG-2024.md`, etc.
 * Does NOT match code files that happen to start with these words —
 * `support.ts`, `historyManager.ts`, `newsfeed.js` are kept.
 */
const DENY_BASENAME_STEMS: readonly string[] = [
  "license",
  "licence",
  "copying",
  "copyright",
  "notice",
  "authors",
  "contributors",
  "maintainers",
  "contributing",
  "code-of-conduct",
  "security",
  "governance",
  "funding",
  "support",
  "changelog",
  "history",
  "news",
];

/**
 * Extensions considered doc/text. Only files with these extensions
 * (or no extension) are eligible for the meta-file deny rule.
 */
const DOC_EXTS: ReadonlySet<string> = new Set(["", "md", "rst", "txt", "adoc"]);

/**
 * Decide whether a repository-relative path is worth indexing for review context.
 *
 * Filters:
 *   - tree-anywhere noise directories (node_modules, dist, .github, ...)
 *   - dotfiles at any depth (.prettierrc, .editorconfig, ...)
 *   - tracked-on-purpose meta documents (LICENSE, CONTRIBUTING.md, CHANGELOG-2024.md, ...)
 *
 * README* is intentionally NOT denied — architectural intent lives there.
 *
 * Pure and stateless. Safe to call from any RepositorySource.
 */
export function isIndexable(relPath: string): boolean {
  const segments = relPath.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) return false;

  for (const seg of segments) {
    if (DENY_SEGMENTS.has(seg)) return false;
  }

  const basename = segments[segments.length - 1]!;

  if (basename.startsWith(".")) return false;

  const dotIdx = basename.lastIndexOf(".");
  const stem = (
    dotIdx === -1 ? basename : basename.slice(0, dotIdx)
  ).toLowerCase();
  const ext = (dotIdx === -1 ? "" : basename.slice(dotIdx + 1)).toLowerCase();

  const normStem = stem.replace(/_/g, "-");

  if (DOC_EXTS.has(ext)) {
    for (const entry of DENY_BASENAME_STEMS) {
      if (normStem === entry || normStem.startsWith(entry + "-")) return false;
    }
  }

  return true;
}
