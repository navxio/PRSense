// packages/context/src/symbolGraph/SymbolGraphContextProvider.ts
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  type ContextAvailabilityInput,
  type ContextChunk,
  type ContextInput,
  type ContextProvider,
  type DiffHunk,
} from "@prsense/core";
import {
  findExportedDeclarations,
  type ExportedDeclaration,
} from "./ast/findExportedDeclarations.js";

export class SymbolGraphContextProvider implements ContextProvider {
  readonly name = "symbol-graph";

  private candidates: Map<string, ExportedDeclaration[]> = new Map();

  constructor(
    private readonly deps: {
      repoRoot: string;
    },
  ) {}

  async isAvailable(input: ContextAvailabilityInput): Promise<boolean> {
    this.candidates.clear();

    const tsFiles = input.diff.files.filter((f) => isTsFile(f.path));
    if (tsFiles.length === 0) return false;

    if (!(await fileExists(join(this.deps.repoRoot, "tsconfig.json")))) {
      return false;
    }

    for (const file of tsFiles) {
      const hunks = file.hunks;
      if (!hunks || hunks.length === 0) continue;

      const absPath = join(this.deps.repoRoot, file.path);
      let content: string;
      try {
        content = await fs.readFile(absPath, "utf8");
      } catch {
        continue; // deleted or unreadable
      }

      const declarations = findExportedDeclarations(file.path, content);
      const overlapping = declarations.filter((d) =>
        someHunkOverlaps(hunks, d.startLine, d.endLine),
      );

      if (overlapping.length > 0) {
        this.candidates.set(file.path, overlapping);
      }
    }

    return this.candidates.size > 0;
  }

  async getContextForFile(_input: ContextInput): Promise<ContextChunk[]> {
    return [];
  }
}

function isTsFile(path: string): boolean {
  return /\.(ts|tsx|mts|cts)$/.test(path);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function someHunkOverlaps(
  hunks: DiffHunk[],
  startLine: number,
  endLine: number,
): boolean {
  // Inclusive ranges on both sides; intersection iff ranges overlap.
  return hunks.some((h) => h.startLine <= endLine && startLine <= h.endLine);
}
