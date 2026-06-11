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
 * Basename prefixes (case-insensitive) that mark a file as non-indexable.
 * Matches LICENSE, LICENSE.md, LICENSE-MIT, etc.
 */
const DENY_BASENAME_PREFIXES: readonly string[] = [
  "license",
  "licence",
  "copying",
  "copyright",
  "notice",
  "authors",
  "contributors",
  "maintainers",
  "contributing",
  "code_of_conduct",
  "security",
  "governance",
  "funding",
  "support",
  "changelog",
  "history",
  "news",
];

/**
 * Decide whether a repository-relative path is worth indexing for review context.
 *
 * Filters:
 *   - tree-anywhere noise directories (node_modules, dist, .github, ...)
 *   - dotfiles at any depth (.prettierrc, .editorconfig, ...)
 *   - tracked-on-purpose meta files (LICENSE, CONTRIBUTING, CHANGELOG, ...)
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

  const lower = basename.toLowerCase();
  for (const prefix of DENY_BASENAME_PREFIXES) {
    if (lower.startsWith(prefix)) return false;
  }

  return true;
}
