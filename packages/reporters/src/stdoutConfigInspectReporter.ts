// packages/reporters/src/stdoutConfigInspectReporter.ts
import kleur from "kleur";
import type {
  ResolvedConfig,
  CredentialContext,
  ValidationIssue,
} from "@prsense/config";

type Source = "default" | "global" | "repo" | "env" | "cli";

export interface ConfigInspectInput {
  config: ResolvedConfig;
  provenance: Record<string, Source>;
  credentials: CredentialContext;
  issues?: ValidationIssue[];
  format?: "table" | "json";
}

const SOURCE_COLOR: Record<Source, (s: string) => string> = {
  default: kleur.dim,
  global: kleur.cyan,
  repo: kleur.green,
  env: kleur.magenta,
  cli: kleur.yellow,
};

const HIDDEN_PATHS = new Set(["repository.root", "database.url"]);

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

function renderTable(input: ConfigInspectInput): string {
  const rows = flatten(input.config)
    .filter(([path]) => !HIDDEN_PATHS.has(path))
    .map(([path, value]) => ({
      path,
      value: formatValue(value),
      source: input.provenance[path] ?? "default",
    }));

  const pathW = Math.max(...rows.map((r) => r.path.length), 4);
  const valueW = Math.max(...rows.map((r) => r.value.length), 5);

  const lines: string[] = [];

  lines.push(kleur.bold("Configuration"));
  lines.push(kleur.dim("─".repeat(pathW + valueW + 16)));
  for (const r of rows) {
    const color = SOURCE_COLOR[r.source];
    lines.push(
      `  ${r.path.padEnd(pathW)}  ${r.value.padEnd(valueW)}  ${color(r.source)}`,
    );
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

  lines.push(
    kleur.dim(
      `Sources: ${SOURCE_COLOR.default("default")} · ${SOURCE_COLOR.global("global")} · ${SOURCE_COLOR.repo("repo")} · ${SOURCE_COLOR.env("env")} · ${SOURCE_COLOR.cli("cli")}`,
    ),
  );

  return lines.join("\n");
}

function renderCredentials(creds: CredentialContext): string[] {
  const entries: Array<[string, string]> = [];

  const status = (avail: boolean, detail?: string) =>
    avail
      ? kleur.green("available") + (detail ? kleur.dim(` (${detail})`) : "")
      : kleur.dim("not configured");

  entries.push(["openai", status(creds.openai.available)]);
  entries.push(["google", status(creds.google.available)]);
  entries.push(["anthropic", status(creds.anthropic.available)]);
  entries.push([
    "github",
    creds.github.available ? status(true, creds.github.mode) : status(false),
  ]);
  entries.push(["gitlab", status(creds.gitlab.available)]);
  entries.push(["slack", status(creds.slack.available)]);

  const w = Math.max(...entries.map(([k]) => k.length));
  return entries.map(([k, v]) => `  ${k.padEnd(w)}  ${v}`);
}

function renderJson(input: ConfigInspectInput): string {
  const credentialsRedacted = {
    openai: { available: input.credentials.openai.available },
    google: { available: input.credentials.google.available },
    anthropic: { available: input.credentials.anthropic.available },
    github: {
      available: input.credentials.github.available,
      ...(input.credentials.github.available
        ? { mode: input.credentials.github.mode }
        : {}),
    },
    gitlab: { available: input.credentials.gitlab.available },
    slack: { available: input.credentials.slack.available },
  };

  return JSON.stringify(
    {
      config: input.config,
      provenance: input.provenance,
      credentials: credentialsRedacted,
      warnings: (input.issues ?? []).filter((i) => i.level === "warning"),
    },
    null,
    2,
  );
}

export const stdoutConfigInspectReporter = {
  async report(input: ConfigInspectInput): Promise<void> {
    const output =
      input.format === "json" ? renderJson(input) : renderTable(input);
    process.stdout.write(output + "\n");
  },
};
