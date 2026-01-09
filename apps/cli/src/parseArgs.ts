export type ParsedArgs = {
  source: "github" | "fs";
  repoRoot?: string;
  diffPath?: string;
  owner?: string;
  repo?: string;
  pullNumber?: number;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const args = Object.fromEntries(
    argv
      .slice(2)
      .map((arg) => arg.split("="))
      .map(([k, v]) => [k.replace(/^--/, ""), v]),
  );

  return {
    source: (args.source as "github" | "fs") ?? "fs",
    repoRoot: args["repo-root"],
    diffPath: args["diff-path"],
    owner: args.owner,
    repo: args.repo,
    pullNumber: args["pull-number"] ? Number(args["pull-number"]) : undefined,
  };
}
