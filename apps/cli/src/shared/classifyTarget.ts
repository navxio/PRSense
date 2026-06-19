// apps/cli/src/shared/classifyTarget.ts
import path from "node:path";
import { findRepoRoot } from "./findRepoRoot.js";

const GITHUB = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const GITLAB = /gitlab\.com\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/;
const CODEBERG = /codeberg\.org\/([^/]+)\/([^/]+)\/pulls\/(\d+)/;

const stripGit = (s: string) => s.replace(/\.git$/, "");

export function classifyTarget(target: string): ClassifiedTarget {
  const gh = target.match(GITHUB);
  if (gh)
    return {
      provider: "github",
      root: target,
      owner: gh[1]!,
      repo: stripGit(gh[2]!),
      pr: gh[3]!,
    };

  const gl = target.match(GITLAB);
  if (gl)
    return {
      provider: "gitlab",
      root: target,
      group: gl[1]!,
      project: stripGit(gl[2]!),
      mr: gl[3]!,
    };

  const cb = target.match(CODEBERG);
  if (cb)
    return {
      provider: "codeberg",
      root: target,
      owner: cb[1]!,
      repo: stripGit(cb[2]!),
      pr: cb[3]!,
    };

  return { provider: "filesystem", root: findRepoRoot(path.resolve(target)) };
}
