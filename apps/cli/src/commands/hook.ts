// apps/cli/src/commands/hook.ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const HOOK_NAME = "pre-push";
const HOOK_VERSION = 2;
const MARKER = `# prsense-hook:v${HOOK_VERSION}`;

/**
 * Build the shim written to .git/hooks/pre-push.
 *
 * Kept intentionally small. Reads push refs from stdin (git's pre-push
 * protocol), skips branch deletions, and invokes the CLI once per pushed
 * ref with the remote SHA as the diff base.
 *
 * Node and CLI paths are resolved at install time and embedded as absolute
 * paths. Git hooks run with a minimal PATH, so bare `prsense` or relying
 * on shell PATH resolution is unreliable across local/global/version-
 * managed installs. Invoking `node <entry>` also sidesteps Windows .cmd
 * wrapper issues since sh cannot reliably exec .cmd files.
 *
 * PRSENSE_NON_INTERACTIVE prevents first-run setup from hanging the push.
 */
function buildShim(nodePath: string, cliEntry: string): string {
  // sh single-quoting: paths are wrapped in single quotes, and any single
  // quote inside a path is escaped via '\''. Pathological but correct.
  const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

  const node = shQuote(nodePath);
  const cli = shQuote(cliEntry);

  return `#!/bin/sh
${MARKER}
# Managed by \`prsense hook\`. Do not edit by hand.
# Remove with: prsense hook uninstall
# Re-resolve paths with: prsense hook install

NODE=${node}
CLI=${cli}
ZERO=0000000000000000000000000000000000000000

# Sanity check — if Node or the CLI has moved (reinstall, Node upgrade,
# package manager switch), fail loudly with an actionable message.
if [ ! -x "$NODE" ]; then
  echo "prsense hook: Node not found at $NODE" >&2
  echo "Re-run: prsense hook install" >&2
  exit 1
fi
if [ ! -f "$CLI" ]; then
  echo "prsense hook: CLI not found at $CLI" >&2
  echo "Re-run: prsense hook install" >&2
  exit 1
fi

while read -r local_ref local_sha remote_ref remote_sha; do
  # Branch deletion — nothing to review.
  if [ "$local_sha" = "$ZERO" ]; then
    continue
  fi

  # New branch — let the CLI fall back to the configured base branch.
  if [ "$remote_sha" = "$ZERO" ]; then
    PRSENSE_NON_INTERACTIVE=1 "$NODE" "$CLI" review . || exit $?
  else
    PRSENSE_NON_INTERACTIVE=1 "$NODE" "$CLI" review . --base-ref "$remote_sha" || exit $?
  fi
done

exit 0
`;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

type HookState =
  | { kind: "absent" }
  | { kind: "ours"; version: number; path: string }
  | { kind: "foreign"; path: string };

/**
 * The minimum git version PRSense's hook command supports. Tied to the
 * availability of `git rev-parse --path-format=absolute`, which we use
 * to make hooks-directory resolution unambiguous across cwds, worktrees,
 * and `core.hooksPath` configurations.
 *
 * Older git versions could be supported by falling back to manual
 * cwd-relative resolution, but the complexity isn't justified for the
 * current target audience (modern dev environments). Documented in the
 * README's requirements section.
 */
const MIN_GIT_MAJOR = 2;
const MIN_GIT_MINOR = 31;

/**
 * Parse `git --version` output. Returns null if git is not installed
 * or the output doesn't match the expected format.
 *
 * `git --version` emits "git version 2.43.0" or, on macOS with Apple's
 * shipped git, "git version 2.39.3 (Apple Git-145)". Both parse.
 */
function getGitVersion(): { major: number; minor: number } | null {
  try {
    const out = execSync("git --version", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    const match = out.match(/git version (\d+)\.(\d+)/);
    if (!match || !match[1] || !match[2]) return null;

    return {
      major: Number(match[1]),
      minor: Number(match[2]),
    };
  } catch {
    return null;
  }
}

function assertGitVersion(): void {
  const version = getGitVersion();

  if (!version) {
    throw new Error(
      "Could not determine git version. Is git installed and on PATH?",
    );
  }

  const ok =
    version.major > MIN_GIT_MAJOR ||
    (version.major === MIN_GIT_MAJOR && version.minor >= MIN_GIT_MINOR);

  if (!ok) {
    throw new Error(
      `prsense hook requires git ${MIN_GIT_MAJOR}.${MIN_GIT_MINOR} or newer ` +
        `(you have ${version.major}.${version.minor}). ` +
        `Please upgrade git, or run \`prsense review\` directly without the hook.`,
    );
  }
}

function resolveHooksDir(): string {
  assertGitVersion();

  // Confirm we're in a git repository up-front, so subsequent failures
  // from rev-parse can be attributed to the right cause rather than
  // bundled into a misleading "not a git repository" catch-all.
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Not inside a git repository. Run `prsense hook install` from your repo root.",
    );
  }

  // Detect core.hooksPath presence purely to warn the user — the actual
  // path resolution is delegated to git (see below). This catches the
  // Husky/lefthook case where prsense would otherwise install into a
  // managed-hooks directory the user didn't realize was active.
  let hooksPathSetting: string | null = null;
  try {
    hooksPathSetting = execSync("git config --get core.hooksPath", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    // exit code 1 means key not set; treat as unset.
  }

  if (hooksPathSetting) {
    console.warn(
      `Note: core.hooksPath is set to "${hooksPathSetting}". prsense will install into that directory.`,
    );
    console.warn(
      "If you use Husky, lefthook, or another hooks manager, you may want to integrate manually instead.",
    );
  }

  // Delegate path resolution to git entirely. `git rev-parse --git-path
  // hooks` honors core.hooksPath, resolves relative values against the
  // worktree root (per githooks(5)), handles worktrees correctly (uses
  // the shared common dir, not the per-worktree git dir), and with
  // --path-format=absolute is immune to cwd-sensitivity. Manually
  // replicating any of this is error-prone — and we've shipped at least
  // one bug doing exactly that. Let git own this.
  return execSync("git rev-parse --path-format=absolute --git-path hooks", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function inspectHook(hookPath: string): HookState {
  if (!fs.existsSync(hookPath)) {
    return { kind: "absent" };
  }

  const contents = fs.readFileSync(hookPath, "utf8");
  const match = contents.match(/# prsense-hook:v(\d+)/);

  if (match && match[1]) {
    return {
      kind: "ours",
      version: Number(match[1]),
      path: hookPath,
    };
  }

  return { kind: "foreign", path: hookPath };
}

function writeShim(hookPath: string): void {
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });

  const { nodePath, cliEntry } = resolveLauncher();
  const shim = buildShim(nodePath, cliEntry);

  fs.writeFileSync(hookPath, shim, { mode: 0o755 });

  // mode in writeFileSync is masked by umask on some systems —
  // chmod explicitly to be safe.
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // Windows: chmod is a no-op, ignore.
  }
}

/**
 * Resolve the absolute paths to embed in the hook shim.
 *
 * - nodePath: the running Node binary. Stable for the lifetime of this
 *   Node install. If the user reinstalls Node at a different prefix
 *   (e.g. brew upgrade, fnm install), the hook's sanity check fails
 *   loudly and tells them to re-run `prsense hook install`.
 *
 * - cliEntry: the CLI's main script. Resolved by walking up from this
 *   module to the package.json and reading the `bin` field, which is
 *   the canonical entry point regardless of how the user installed
 *   (global, local, linked, pnpm, npm, yarn, volta).
 */
/**
 * The expected `name` field of the prsense CLI package. Used to
 * disambiguate when the walk passes through other package.jsons
 * (e.g. a monorepo root) on the way to ours.
 */
const CLI_PACKAGE_NAME = "@prsense/cli";

function resolveLauncher(): { nodePath: string; cliEntry: string } {
  const nodePath = process.execPath;

  // Walk up from this module to find the prsense CLI's own package.json.
  //
  // We match by name rather than taking the first package.json found,
  // because in a development checkout or unusual install layout the walk
  // could pass through a workspace root package.json on the way to ours.
  // Taking the first hit risks pointing the hook shim at the wrong
  // entrypoint (e.g. the monorepo root's `main` field).
  //
  // fileURLToPath is required (not just `new URL(...).pathname`) because
  // on Windows the latter returns paths like `/C:/...` that aren't valid
  // filesystem paths and may still be percent-encoded.
  const here = path.dirname(fileURLToPath(import.meta.url));

  let dir = here;
  let pkgPath: string | null = null;

  // Walk further than before — up to 10 levels — since monorepo or
  // symlinked layouts can put more directories between us and the
  // package.json we're looking for.
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "package.json");

    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf8")) as {
          name?: string;
        };
        if (pkg.name === CLI_PACKAGE_NAME) {
          pkgPath = candidate;
          break;
        }
        // Wrong package.json — keep walking. This is the change: we no
        // longer stop at the first match.
      } catch {
        // Malformed package.json — keep walking rather than failing.
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (!pkgPath) {
    throw new Error(
      `Could not locate the ${CLI_PACKAGE_NAME} package.json starting from ${here}. ` +
        "The prsense install may be broken or unusually laid out.",
    );
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
    bin?: string | Record<string, string>;
    main?: string;
  };

  let entryRel: string | undefined;
  if (typeof pkg.bin === "string") {
    entryRel = pkg.bin;
  } else if (pkg.bin && typeof pkg.bin === "object") {
    entryRel = pkg.bin["prsense"] ?? Object.values(pkg.bin)[0];
  }
  entryRel = entryRel ?? pkg.main;

  if (!entryRel) {
    throw new Error(
      `Could not determine the CLI entry script from ${pkgPath} (no bin or main field).`,
    );
  }

  const cliEntry = path.resolve(path.dirname(pkgPath), entryRel);

  if (!fs.existsSync(cliEntry)) {
    throw new Error(
      `Resolved CLI entry does not exist at ${cliEntry}. The prsense install may be broken.`,
    );
  }

  return { nodePath, cliEntry };
}

/* ------------------------------------------------------------------ */
/* Command                                                            */
/* ------------------------------------------------------------------ */

export const hookCommand = new Command("hook").description(
  "Manage prsense interaction with git hooks",
);

hookCommand
  .command("install")
  .description("Install the prsense pre-push review hook")
  .option("-f, --force", "Overwrite an existing non-prsense hook")
  .action(async (opts: { force?: boolean }) => {
    try {
      const hooksDir = resolveHooksDir();
      const hookPath = path.join(hooksDir, HOOK_NAME);
      const state = inspectHook(hookPath);

      if (state.kind === "ours") {
        if (state.version === HOOK_VERSION) {
          console.log(
            `prsense ${HOOK_NAME} hook already installed (v${state.version}).`,
          );
          return;
        }

        console.log(
          `Upgrading prsense ${HOOK_NAME} hook: v${state.version} → v${HOOK_VERSION}`,
        );
        writeShim(hookPath);
        console.log(`✔ Installed at ${hookPath}`);
        return;
      }

      if (state.kind === "foreign" && !opts.force) {
        console.error(
          `A ${HOOK_NAME} hook already exists at ${hookPath} and was not installed by prsense.`,
        );
        console.error("");
        console.error("Options:");
        console.error("  • Inspect it and integrate prsense manually, or");
        console.error("  • Re-run with --force to overwrite it.");
        process.exit(1);
      }

      writeShim(hookPath);
      console.log(`✔ Installed prsense ${HOOK_NAME} hook at ${hookPath}`);
      console.log("");
      console.log("Your next `git push` will be reviewed by prsense.");
      console.log("To bypass for a single push: `git push --no-verify`");
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

hookCommand
  .command("uninstall")
  .description("Remove the prsense pre-push review hook")
  .action(async () => {
    try {
      const hooksDir = resolveHooksDir();
      const hookPath = path.join(hooksDir, HOOK_NAME);
      const state = inspectHook(hookPath);

      if (state.kind === "absent") {
        console.log(`No ${HOOK_NAME} hook installed.`);
        return;
      }

      if (state.kind === "foreign") {
        console.error(
          `The ${HOOK_NAME} hook at ${hookPath} was not installed by prsense.`,
        );
        console.error("Refusing to remove it. Delete it manually if intended.");
        process.exit(1);
      }

      fs.unlinkSync(hookPath);
      console.log(`✔ Removed prsense ${HOOK_NAME} hook from ${hookPath}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

hookCommand
  .command("status")
  .description("Show the install state of the prsense hook")
  .action(async () => {
    try {
      const hooksDir = resolveHooksDir();
      const hookPath = path.join(hooksDir, HOOK_NAME);
      const state = inspectHook(hookPath);

      switch (state.kind) {
        case "absent":
          console.log(`prsense ${HOOK_NAME} hook: not installed`);
          console.log("");
          console.log("Install with: prsense hook install");
          break;

        case "ours":
          if (state.version === HOOK_VERSION) {
            console.log(
              `prsense ${HOOK_NAME} hook: installed (v${state.version}, up to date)`,
            );
          } else {
            console.log(
              `prsense ${HOOK_NAME} hook: installed (v${state.version}, current is v${HOOK_VERSION})`,
            );
            console.log("");
            console.log("Upgrade with: prsense hook install");
          }
          console.log(`Path: ${state.path}`);
          break;

        case "foreign":
          console.log(`${HOOK_NAME} hook: present, but not managed by prsense`);
          console.log(`Path: ${state.path}`);
          console.log("");
          console.log("Run `prsense hook install --force` to replace it.");
          break;
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

export default hookCommand;
