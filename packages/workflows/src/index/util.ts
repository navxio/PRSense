// packages/workflows/src/index/util.ts
import { execFileSync } from "node:child_process";

import path from "node:path";
import type { IndexMetadata, ContextChunk } from "@prsense/core";
import { EventBus, CoreEvents } from "@prsense/core";

import type { IndexPlan } from "./types.js";
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
    ["ls-tree", "-r", commitSha],
    { cwd: repoPath }
  ).toString("utf8");

  const map = new Map<string, string>();

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;

    // format: mode type sha\tpath
    const [meta, filePath] = line.split("\t");
    if (!meta || !filePath) continue;

    const parts = meta.split(" ");
    const sha = parts[2];

    if (sha) {
      map.set(filePath, sha);
    }
  }

  return map;
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