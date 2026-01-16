import fs from "node:fs/promises";
import path from "node:path";

import type { RepositorySource, RepositoryFile } from "./types.js";

export function createFilesystemRepositorySource(
  repoRoot: string,
): RepositorySource {
  const repoName = path.basename(repoRoot);

  async function* walk(
    dir: string,
    baseDir: string,
  ): AsyncIterable<RepositoryFile> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Skip common junk
      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        yield* walk(fullPath, baseDir);
        continue;
      }

      if (!entry.isFile()) continue;

      // Basic heuristic: only index text-like files
      const content = await fs.readFile(fullPath, "utf8").catch(() => null);
      if (content === null) continue;

      yield {
        path: relativePath,
        content,
        language: inferLanguageFromPath(relativePath),
      };
    }
  }

  return {
    repo: {
      id: `local:${repoRoot}`,
      name: repoName,
    },

    files(): AsyncIterable<RepositoryFile> {
      return walk(repoRoot, repoRoot);
    },
  };
}

function inferLanguageFromPath(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".js":
      return "javascript";
    case ".py":
      return "python";
    case ".md":
      return "markdown";
    case ".json":
      return "json";
    default:
      return undefined;
  }
}
