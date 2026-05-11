// apps/cli/src/commands/hook.ts
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const HOOK_NAME = "pre-push";
const HOOK_VERSION = 1;
const MARKER = `# prsense-hook:v${HOOK_VERSION}`;

/**
 * The shim written to .git/hooks/pre-push.
 *
 * Kept intentionally small. Reads push refs from stdin (git's pre-push
 * protocol), skips branch deletions, and invokes `prsense review`
 * once per pushed ref with the remote SHA as the diff base.
 *
 * PRSENSE_NON_INTERACTIVE prevents first-run setup from hanging the push.
 */
const SHIM = `#!/bin/sh
${MARKER}
# Managed by \`prsense hook\`. Do not edit by hand.
# Remove with: prsense hook uninstall

ZERO=0000000000000000000000000000000000000000

while read -r local_ref local_sha remote_ref remote_sha; do
  # Branch deletion — nothing to review.
  if [ "$local_sha" = "$ZERO" ]; then
    continue
  fi

  # New branch — let the CLI fall back to the configured base branch.
  if [ "$remote_sha" = "$ZERO" ]; then
    PRSENSE_NON_INTERACTIVE=1 prsense review . || exit $?
  else
    PRSENSE_NON_INTERACTIVE=1 prsense review . --base-ref "$remote_sha" || exit $?
  fi
done

exit 0
`;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

type HookState =
  | { kind: "absent" }
  | { kind: "ours"; version: number; path: string }
  | { kind: "foreign"; path: string };

function resolveHooksDir(): string {
  try {
    const out = execSync("git rev-parse --git-path hooks", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    // `git rev-parse --git-path` returns a path relative to cwd.
    return path.resolve(process.cwd(), out);
  } catch {
    throw new Error(
      "Not inside a git repository. Run `prsense hook install` from your repo root.",
    );
  }
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
  fs.writeFileSync(hookPath, SHIM, { mode: 0o755 });

  // mode in writeFileSync is masked by umask on some systems —
  // chmod explicitly to be safe.
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // Windows: chmod is a no-op, ignore.
  }
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
