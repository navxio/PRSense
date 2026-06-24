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
import { loadProjects, type LoadedProjects } from "./projects/loadProjects.js";

export class SymbolGraphContextProvider implements ContextProvider {
  readonly name = "symbol-graph";

  private candidates: Map<string, ExportedDeclaration[]> = new Map();
  private projectsPromise: Promise<LoadedProjects> | null = null;

  constructor(
    private readonly deps: {
      repoRoot: string;
      baseSha: string;
    },
  ) {}

  async isAvailable(input: ContextAvailabilityInput): Promise<boolean> {
    if (this.deps.baseSha === "unknown" || !this.deps.baseSha) return false;
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
        continue;
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

  async getContextForFile(input: ContextInput): Promise<ContextChunk[]> {
    const fileCandidates = this.candidates.get(input.file.path);
    if (!fileCandidates || fileCandidates.length === 0) return [];

    // Singleton lazy-load. Concurrent callers all await the same promise.
    if (!this.projectsPromise) {
      this.projectsPromise = loadProjects({
        repoRoot: this.deps.repoRoot,
        baseSha: this.deps.baseSha,
      });
    }
    const projects = await this.projectsPromise;
    void projects; // step 6: structural signature diff + reference query

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
  return hunks.some((h) => h.startLine <= endLine && startLine <= h.endLine);
}
