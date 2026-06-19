// apps/cli/src/shared/classifyTarget.ts
import path from "node:path";
import type { ClassifiedTarget } from "@prsense/core";
import { findRepoRoot } from "./findRepoRoot.js";

const GITHUB_PR = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const GITLAB_MR = /gitlab\.com\/(.+?)\/([^/]+)\/-\/merge_requests\/(\d+)/;
const CODEBERG_PR = /codeberg\.org\/([^/]+)\/([^/]+)\/pulls\/(\d+)/;
const GITHUB_REPO = /github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/;
const GITLAB_REPO = /gitlab\.com\/(.+?)\/([^/?#]+?)(?:\.git)?\/?$/;
const CODEBERG_REPO = /codeberg\.org\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/;

const stripGit = (s: string) => s.replace(/\.git$/, "");

export function classifyTarget(target: string): ClassifiedTarget {
  const ghPr = target.match(GITHUB_PR);
  if (ghPr)
    return {
      provider: "github",
      kind: "pr",
      root: target,
      owner: ghPr[1]!,
      repo: stripGit(ghPr[2]!),
      pr: ghPr[3]!,
    };

  const glMr = target.match(GITLAB_MR);
  if (glMr)
    return {
      provider: "gitlab",
      kind: "mr",
      root: target,
      group: glMr[1]!,
      project: stripGit(glMr[2]!),
      mr: glMr[3]!,
    };

  const cbPr = target.match(CODEBERG_PR);
  if (cbPr)
    return {
      provider: "codeberg",
      kind: "pr",
      root: target,
      owner: cbPr[1]!,
      repo: stripGit(cbPr[2]!),
      pr: cbPr[3]!,
    };

  const ghRepo = target.match(GITHUB_REPO);
  if (ghRepo)
    return {
      provider: "github",
      kind: "repo",
      root: target,
      owner: ghRepo[1]!,
      repo: stripGit(ghRepo[2]!),
    };

  const glRepo = target.match(GITLAB_REPO);
  if (glRepo)
    return {
      provider: "gitlab",
      kind: "repo",
      root: target,
      group: glRepo[1]!,
      project: stripGit(glRepo[2]!),
    };

  const cbRepo = target.match(CODEBERG_REPO);
  if (cbRepo)
    return {
      provider: "codeberg",
      kind: "repo",
      root: target,
      owner: cbRepo[1]!,
      repo: stripGit(cbRepo[2]!),
    };

  return { provider: "filesystem", root: findRepoRoot(path.resolve(target)) };
}
