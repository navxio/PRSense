// packages/workflows/src/index/util.ts
import { execFileSync } from "node:child_process";

import path from "node:path";
import type { IndexMetadata, ContextChunk } from "@prsense/core";
import { EventBus, CoreEvents } from "@prsense/core";

import type { IndexPlan } from "./types.js";
import type { RepositorySource } from "@prsense/context";
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
    return { type: "full" }
  }

  if (!commitChanged) return { type: "noop" }

  return {
    type: "incremental",
    baseSha: stored.revision.commitSha,
    targetSha: currentFingerprint.commitSha,
  };
}

//TODO: move this to context
export function computeDiff({
  repoPath,
  baseSha,
  targetSha,
}: {
  repoPath: string;
  baseSha: string;
  targetSha: string;
}) {
  const output = execFileSync(
    "git",
    ["diff", "--name-status", "-z", baseSha, targetSha],
    { cwd: repoPath }
  );

  const tokens = output.toString("utf8").split("\0").filter(Boolean);

  const changed: string[] = [];
  const deleted: string[] = [];

  let i = 0;

  while (i < tokens.length) {
    const status = tokens[i++];

    if (!status) break;

    // 🟢 Rename / Copy (2 paths)
    if (status.startsWith("R") || status.startsWith("C")) {
      const oldPath = tokens[i++];
      const newPath = tokens[i++];

      if (status.startsWith("R")) {
        if (oldPath) deleted.push(oldPath);
        if (newPath) changed.push(newPath);
      } else {
        if (newPath) changed.push(newPath);
      }

      continue;
    }

    // 🟢 Normal case (1 path)
    const file = tokens[i++];

    if (!file) {
      console.warn("Malformed diff entry:", { status, tokens, i });
      continue;
    }

    if (status === "D") {
      deleted.push(file);
    } else {
      changed.push(file);
    }
  }
  const clean = (arr: string[]) =>
    arr.map(f => f.trim()).filter(Boolean);

  return {
    changed: clean(changed),
    deleted: clean(deleted),
  };

}

export async function buildChunks({
  files,
  repositorySource,
  chunker,
  eventBus,
}: {
  files: string[];
  repositorySource: RepositorySource;
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
