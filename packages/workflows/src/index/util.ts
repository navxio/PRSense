// packages/workflows/src/index/util.ts
import { execFileSync } from "node:child_process";
import type {
  IndexMetadata,
  ContextChunk,
  ClassifiedTarget,
} from "@prsense/core";
import { EventBus, CoreEvents } from "@prsense/core";

import type { IndexPlan, ExecutionPlan } from "./types.js";
import type { GitBackedRepositorySource } from "@prsense/context";
import type { CredentialContext } from "@prsense/config";
import {
  createCharChunker,
  detectKind,
  detectLanguage,
  FileSystemRepositorySource,
  RefAwareRepositorySource,
  githubRepositorySource,
  gitlabRepositorySource,
  codebergRepositorySource,
} from "@prsense/context";

export function resolveRepositorySource(
  target: ClassifiedTarget,
  credentials: CredentialContext,
  ref?: string,
) {
  switch (target.provider) {
    case "github":
      return githubRepositorySource(
        target.owner,
        target.repo,
        credentials.github?.token,
      );
    case "gitlab":
      return gitlabRepositorySource(
        target.group,
        target.project,
        credentials.gitlab?.token,
      );
    case "codeberg":
      return codebergRepositorySource(
        target.owner,
        target.repo,
        credentials.codeberg?.token,
      );
    case "filesystem": {
      const src = new FileSystemRepositorySource(target.root);
      return ref ? new RefAwareRepositorySource(src, ref) : src;
    }
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
    ["ls-tree", "-r", "-z", "--format=%(objectname)%x00%(path)", commitSha],
    { cwd: repoPath },
  );

  const parts = output.toString("utf8").split("\0");

  if (parts[parts.length - 1] === "") parts.pop();

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

  const pathsToDelete = Array.from(new Set([...changedFiles, ...deletedFiles]));

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

export async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
