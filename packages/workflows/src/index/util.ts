// packages/workflows/src/index/util.ts
import { execFileSync } from "node:child_process";

import path from "node:path";
import type { IndexMetadata, ContextChunk } from "@prsense/core";
import { EventBus, CoreEvents } from "@prsense/core";

import type { IndexPlan, ExecutionPlan } from "./types.js";
import type { GitBackedRepositorySource } from "@prsense/context";
import {
  createCharChunker,
  detectKind,
  detectLanguage,
  FileSystemRepositorySource,
  GitLabRepositorySource,
  GitHubRepositorySource,
} from "@prsense/context";

export function resolveRepositorySource(target: string) {
  const isGithub = /github\.com/.test(target);
  const isGitlab = /gitlab\.com/.test(target);

  if (isGithub) {
    const match = target.match(/github\.com\/([^\/]+)\/([^\/]+)/);

    if (!match) {
      throw new Error("Invalid GitHub URL");
    }

    const owner = match[1];
    const repo = match[2];

    if (!owner || !repo) {
      throw new Error("Invalid GitHub repository url");
    }

    return new GitHubRepositorySource(owner, repo.replace(".git", ""));
  } else if (isGitlab) {
    const match = target.match(/gitlab\.com\/(.+?)\/([^\/]+)(?:\.git)?$/);

    if (!match) throw new Error("Invalid GitLab URL");

    const owner = match[1];
    const repo = match[2];
    if (!owner || !repo) throw new Error("Invalid GitLab repository url");
    return new GitLabRepositorySource(owner, repo.replace(".git", ""));
  } else {
    const absolute = path.resolve(target);
    return new FileSystemRepositorySource(absolute);
  }
}

export function planIndex({
  stored,
  currentFingerprint,
  force,
}: {
  stored: IndexMetadata | null;
  currentFingerprint: any;
  force?: boolean;
}): IndexPlan {
  if (!stored) return { type: "full" };
  if (force) return { type: "full" };

  const commitChanged =
    stored.revision.commitSha !== currentFingerprint.commitSha;

  const embeddingChanged =
    stored.embedding.provider !== currentFingerprint.embeddingProvider ||
    stored.embedding.model !== currentFingerprint.embeddingModel;

  const chunkingChanged =
    stored.chunking.strategy !== currentFingerprint.chunkStrategy ||
    stored.chunking.version !== currentFingerprint.chunkVersion;

  if (embeddingChanged || chunkingChanged) {
    return { type: "full" };
  }

  if (!commitChanged) return { type: "noop" };

  return {
    type: "incremental",
    baseSha: stored.revision.commitSha,
    targetSha: currentFingerprint.commitSha,
  };
}

export async function buildChunks({
  files,
  repositorySource,
  chunker,
  eventBus,
}: {
  files: string[];
  repositorySource: GitBackedRepositorySource;
  chunker: ReturnType<typeof createCharChunker>;
  eventBus: EventBus;
}): Promise<ContextChunk[]> {
  const chunks: ContextChunk[] = [];

  for (const file of files) {
    try {
      const content = await repositorySource.readFile(file);
      const kind = detectKind(file);
      const language = detectLanguage(file);

      const fileChunks = chunker.chunk({
        content,
        source: { kind: "file", path: file },
      });

      for (const chunk of fileChunks) {
        chunk.metadata = {
          ...chunk.metadata,
          path: file,
          kind,
          ...(language ? { language } : {}),
        };
      }

      chunks.push(...fileChunks);
    } catch (err) {
      if (err instanceof Error && err.message === "BINARY_FILE_DETECTED") {
        eventBus.emit(CoreEvents.ContextFileSkipped, {
          path: file,
          reason: "binary",
        });
        continue;
      }
      throw err;
    }
  }

  return chunks;
}

export function getGitFileSnapshot({
  repoPath,
  commitSha,
}: {
  repoPath: string;
  commitSha: string;
}): Map<string, string> {
  const output = execFileSync(
    "git",
    [
      "ls-tree",
      "-r",
      "-z",
      "--format=%(objectname)%x00%(path)",
      commitSha,
    ],
    { cwd: repoPath }
  );

  const parts = output.toString("utf8").split("\0");

  if (parts[parts.length - 1] === "") parts.pop()

  const snapshot = new Map<string, string>();

  for (let i = 0; i < parts.length - 1; i += 2) {
    const sha = parts[i];
    const path = parts[i + 1];

    if (!sha || !path) continue;

    snapshot.set(path, sha);
  }

  return snapshot;
}
export function computeSnapshotDiff({
  base,
  target,
}: {
  base: Map<string, string>;
  target: Map<string, string>;
}) {
  const changed: string[] = [];
  const deleted: string[] = [];

  // detect changed + added
  for (const [path, sha] of target) {
    if (!base.has(path)) {
      changed.push(path); // new file
    } else if (base.get(path) !== sha) {
      changed.push(path); // modified
    }
  }

  // detect deleted
  for (const path of base.keys()) {
    if (!target.has(path)) {
      deleted.push(path);
    }
  }

  return { changed, deleted };
}

export function resolveExecutionPlan({
  plan,
  repoPath,
}: {
  plan: IndexPlan;
  repoPath: string;
}): ExecutionPlan {
  if (plan.type === "noop") {
    return { kind: "noop" };
  }

  if (plan.type === "full") {
    // NOTE: still async upstream, so just signal intent here
    return { kind: "full", files: [] }; // files filled later
  }

  // incremental
  const baseSnapshot = getGitFileSnapshot({
    repoPath,
    commitSha: plan.baseSha,
  });

  const targetSnapshot = getGitFileSnapshot({
    repoPath,
    commitSha: plan.targetSha,
  });

  const diff = computeSnapshotDiff({
    base: baseSnapshot,
    target: targetSnapshot,
  });

  const changedFiles = diff.changed;
  const deletedFiles = diff.deleted;

  if (changedFiles.length === 0 && deletedFiles.length === 0) {
    return { kind: "noop" };
  }

  const pathsToDelete = Array.from(
    new Set([...changedFiles, ...deletedFiles]),
  );

  if (changedFiles.length === 0 && deletedFiles.length > 0) {
    return {
      kind: "delete-only",
      deletedFiles,
      pathsToDelete,
    };
  }

  return {
    kind: "incremental",
    changedFiles,
    deletedFiles,
    pathsToDelete,
  };
}