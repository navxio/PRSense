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
      .map((arg) => {
        const [k, v] = arg.split("=");
        if (!k) return null;
        return [k.replace(/^--/, ""), v] as const;
      })
      .filter((x): x is readonly [string, string | undefined] => x !== null),
  );

  const result: ParsedArgs = {
    source: (args.source as "github" | "fs") ?? "fs",
  };

  if (args["repo-root"]) result.repoRoot = args["repo-root"];
  if (args["diff-path"]) result.diffPath = args["diff-path"];
  if (args.owner) result.owner = args.owner;
  if (args.repo) result.repo = args.repo;
  if (args["pull-number"]) {
    result.pullNumber = Number(args["pull-number"]);
  }

  return result;
}
