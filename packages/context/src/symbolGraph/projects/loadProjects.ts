// packages/context/src/symbolGraph/projects/loadProjects.ts
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { join, posix } from "node:path";
import { Project, InMemoryFileSystemHost } from "ts-morph";
import {
  createGitObjectReader,
  type GitObjectReader,
} from "../git/gitObjectReader.js";

const execFile = promisify(execFileCb);

export type LoadedProjects = { head: Project; base: Project };

export async function loadProjects(opts: {
  repoRoot: string;
  baseSha: string;
}): Promise<LoadedProjects> {
  const reader = createGitObjectReader(opts.repoRoot);
  try {
    const [head, base] = await Promise.all([
      loadHeadProject(opts.repoRoot),
      loadBaseProject(opts.baseSha, reader),
    ]);
    return { head, base };
  } finally {
    await reader.close();
  }
}

async function loadHeadProject(repoRoot: string): Promise<Project> {
  const project = new Project({
    tsConfigFilePath: join(repoRoot, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  for (const path of await listTrackedTsFiles(repoRoot)) {
    project.addSourceFileAtPath(path);
  }
  project.resolveSourceFileDependencies();
  return project;
}

async function loadBaseProject(
  baseSha: string,
  reader: GitObjectReader,
): Promise<Project> {
  const inMem = new InMemoryFileSystemHost();

  // tsconfig is mandatory for compilerOptions resolution.
  const rootTsconfig = await reader.readBlob(baseSha, "tsconfig.json");
  inMem.writeFileSync("/tsconfig.json", rootTsconfig);

  // Materialise the relevant superset: ts sources, tsconfigs at any depth,
  // package.json at any depth. Tree entries at a SHA are tracked by
  // definition so no ignore filtering is needed here.
  const tree = await reader.listTree(baseSha);
  const tsPaths: string[] = [];

  for (const { path } of tree) {
    if (!isRelevantFile(path)) continue;
    const content = await reader.readBlob(baseSha, path);
    inMem.writeFileSync(`/${path}`, content);
    if (isTsSourceFile(path)) tsPaths.push(`/${path}`);
  }

  const project = new Project({
    tsConfigFilePath: "/tsconfig.json",
    fileSystem: inMem,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  for (const path of tsPaths) {
    project.addSourceFileAtPath(path);
  }
  project.resolveSourceFileDependencies();
  return project;
}

// HEAD-side enumeration: defer to git so ignore rules are respected
// transitively (nested .gitignore, core.excludesFile, etc.) without
// re-implementing them.
async function listTrackedTsFiles(repoRoot: string): Promise<string[]> {
  const { stdout } = await execFile("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    maxBuffer: 256 * 1024 * 1024,
  });
  const out: string[] = [];
  for (const rel of stdout.split("\0")) {
    if (!rel || !isTsSourceFile(rel)) continue;
    out.push(join(repoRoot, rel));
  }
  return out;
}

function isTsSourceFile(path: string): boolean {
  if (path.endsWith(".d.ts")) return false;
  return /\.(ts|tsx|mts|cts)$/.test(path);
}

function isRelevantFile(path: string): boolean {
  if (isTsSourceFile(path)) return true;
  const base = posix.basename(path);
  if (base === "package.json") return true;
  if (/^tsconfig(?:\.[\w-]+)?\.json$/.test(base)) return true;
  return false;
}
