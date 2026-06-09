// packages/reporters/src/stdoutConfigInspectReporter.ts
import kleur from "kleur";
import type {
  ResolvedConfig,
  CredentialContext,
  ValidationIssue,
} from "@prsense/config";

export interface ConfigInspectInput {
  config: ResolvedConfig;
  credentials: CredentialContext;
  issues?: ValidationIssue[];
}

const HIDDEN_PATHS = new Set(["repository.root"]);

function flatten(
  obj: unknown,
  prefix = "",
  out: Array<[string, unknown]> = [],
): Array<[string, unknown]> {
  if (obj === null || obj === undefined) {
    out.push([prefix, obj]);
    return out;
  }
  if (typeof obj !== "object" || Array.isArray(obj) || obj instanceof Date) {
    out.push([prefix, obj]);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    flatten(v, path, out);
  }
  return out;
}

function formatValue(v: unknown): string {
  if (v === undefined) return kleur.dim("—");
  if (v === null) return kleur.dim("null");
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  return String(v);
}

function renderCredentials(creds: CredentialContext): string[] {
  const status = (avail: boolean, detail?: string) =>
    avail
      ? kleur.green("available") + (detail ? kleur.dim(` (${detail})`) : "")
      : kleur.dim("not configured");

  const github = creds.github ?? { available: false as const };
  const githubDetail =
    github.available && "mode" in github ? github.mode : undefined;

  const entries: Array<[string, string]> = [
    ["openai", status(creds.openai?.available ?? false)],
    ["google", status(creds.google?.available ?? false)],
    ["anthropic", status(creds.anthropic?.available ?? false)],
    ["github", status(github.available, githubDetail)],
    ["gitlab", status(creds.gitlab?.available ?? false)],
    ["slack", status(creds.slack?.available ?? false)],
  ];

  const w = Math.max(...entries.map(([k]) => k.length));
  return entries.map(([k, v]) => `  ${k.padEnd(w)}  ${v}`);
}

function renderTable(input: ConfigInspectInput): string {
  const rows = flatten(input.config)
    .filter(([path]) => !HIDDEN_PATHS.has(path))
    .map(([path, value]) => ({ path, value: formatValue(value) }));

  const pathW = Math.max(...rows.map((r) => r.path.length), 4);

  const lines: string[] = [];

  lines.push(kleur.bold("Configuration"));
  lines.push(kleur.dim("─".repeat(pathW + 24)));
  for (const r of rows) {
    lines.push(`  ${kleur.cyan(r.path.padEnd(pathW))}  ${r.value}`);
  }
  lines.push("");

  lines.push(kleur.bold("Credentials"));
  lines.push(kleur.dim("─".repeat(40)));
  for (const line of renderCredentials(input.credentials)) lines.push(line);
  lines.push("");

  const warnings = (input.issues ?? []).filter((i) => i.level === "warning");
  if (warnings.length > 0) {
    lines.push(kleur.bold().yellow("Warnings"));
    lines.push(kleur.dim("─".repeat(40)));
    for (const w of warnings) lines.push(`  ${kleur.yellow("⚠")} ${w.message}`);
    lines.push("");
  }

  return lines.join("\n");
}

export const stdoutConfigInspectReporter = {
  async report(input: ConfigInspectInput): Promise<void> {
    process.stdout.write(renderTable(input) + "\n");
  },
};
