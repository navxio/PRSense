// packages/context/src/symbolGraph/SymbolGraphContextProvider.ts
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  CoreEvents,
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
import {
  diffSignatures,
  type TriggeredCandidate,
} from "./sig/diffSignature.js";
import { findReferences } from "./refs/findReferences.js";
import { rankAndCap } from "./refs/rankAndCap.js";
import { renderChunks, type PerSymbolReferences } from "./refs/renderChunks.js";

export class SymbolGraphContextProvider implements ContextProvider {
  readonly name = "symbol-graph";

  private candidates: Map<string, ExportedDeclaration[]> = new Map();
  private projectsPromise: Promise<LoadedProjects> | null = null;
  private triggeredPromise: Promise<TriggeredCandidate[]> | null = null;

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

    if (!this.projectsPromise) {
      const start = Date.now();
      this.projectsPromise = loadProjects({
        repoRoot: this.deps.repoRoot,
        baseSha: this.deps.baseSha,
      }).then((projects) => {
        input.eventBus?.emit(
          CoreEvents.WorkflowReviewSymbolGraphProjectsLoaded,
          {
            headFiles: projects.head.getSourceFiles().length,
            baseFiles: projects.base.getSourceFiles().length,
            durationMs: Date.now() - start,
          },
        );
        return projects;
      });
    }
    if (!this.triggeredPromise) {
      this.triggeredPromise = this.projectsPromise.then((projects) =>
        diffSignatures({
          candidatesByFile: this.candidates,
          head: projects.head,
          base: projects.base,
        }),
      );
    }

    const projects = await this.projectsPromise;
    const triggered = await this.triggeredPromise;
    const fileTriggered = triggered.filter(
      (t) => t.filePath === input.file.path,
    );
    if (fileTriggered.length === 0) return [];

    const changedFiles = input.diff.files.map((f) => f.path);
    const perSymbol: PerSymbolReferences[] = [];

    for (const candidate of fileTriggered) {
      const refs = findReferences({
        head: projects.head,
        declarationFile: candidate.filePath,
        symbolName: candidate.name,
        isDefaultExport: candidate.kind === "defaultExport",
        workspaceRoot: this.deps.repoRoot,
      });

      const ranked = rankAndCap({
        references: refs,
        changedFiles,
        declarationFile: candidate.filePath,
      });

      input.eventBus?.emit(
        CoreEvents.WorkflowReviewSymbolGraphReferencesRetrieved,
        {
          symbol: candidate.name,
          file: candidate.filePath,
          totalRefs: ranked.total,
          shownRefs: ranked.shown.length,
        },
      );

      if (ranked.shown.length > 0) {
        perSymbol.push({ candidate, references: ranked });
      }
    }

    const chunks = renderChunks(perSymbol);

    input.eventBus?.emit(CoreEvents.WorkflowReviewContextRetrieved, {
      file: input.file.path,
      chunks: chunks.length,
    });

    return chunks;
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
