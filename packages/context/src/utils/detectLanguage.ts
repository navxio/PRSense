// packages/context/src/utils/detectLanguage.ts
import path from "node:path";

const extensionMap: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",

  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".php": "php",
  ".rb": "ruby",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".c": "c",
  ".h": "c",

  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",

  ".md": "markdown",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",

  ".sql": "sql",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
};

export function detectLanguage(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();

  if (!ext) return undefined;

  return extensionMap[ext];
}
