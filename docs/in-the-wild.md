# PRSense in the Wild

A log of signals PRSense produced while reviewing its own development.

Every entry records:

- **The signal** — what PRSense said, verbatim.
- **The diff context** — the code under review.
- **Why this is non-trivial** — the actual reasoning behind why this is a real catch (or, for false positives, an honest accounting).
- **Would I have caught this myself?** — an honest answer.

> Prose drafted with LLM assistance; signals, investigations, and decisions are mine.

The point of this log is to make the value of grounded review concrete. Claims about edge-case detection are cheap; receipts aren't.

The log includes false positives as well as catches. A reviewer that only logs its wins is doing PR; one that logs its calibration is doing engineering.

## 2026-05 — Concurrency input validation

**File:** `packages/workflows/src/review/util.ts`
**Commit** `a78e40fd08df7d71b77a18ab554f068f4f5c6d8d`

### Signal

PRSense flagged that `runConcurrent` accepted a `concurrency` argument without validating it, and that downstream behavior was undefined for non-integer, zero, or negative values. The function would silently produce wrong results (e.g. `Array.from({ length: 0 }, …)` yields no workers and the function hangs forever on a non-empty `items` array).

### Diff context

```ts
export async function runConcurrent<T, R>({
  items,
  concurrency,
  worker,
}: {
  items: T[];
  concurrency: number;
  worker: (item: T) => Promise<R>;
}): Promise<R[]> {
  if (items.length === 0) return [];
  // ...no validation of `concurrency`
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner()),
  );
  return results;
}
```

### Why this is non-trivial

The signal didn't just say "validate inputs." It identified a specific failure mode: `concurrency = 0` (a plausible misconfiguration from a YAML where someone writes `concurrency: 0` to mean "disabled") would spawn zero workers and hang the entire review pipeline indefinitely on a non-empty file list. That's a hang, not a crash — which is the worst kind of bug because it survives observability.

The fix:

```ts
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error(`Invalid concurrency value: ${concurrency}`);
}
```

Three lines. Catches: zero, negatives, fractions, `NaN`, `Infinity`.

### Would I have caught this myself?

Probably not in the original implementation. At this point, I'm proceeding without a comprehensive test suite, although I added basic behaviour unit tests - the former would help me identify and address this quickly.

---

## 2026-05 — Pre-push hook PATH resolution

**File:** `apps/cli/src/commands/hook.ts`
**Commit:** `7cd7dd08f786f6d50aed8fa9f6fa7aebb29efdc0`

### Signal

> [HIGH] The installed hook invokes `prsense review` by command name, which will fail in common local-install setups where the CLI is not globally on PATH during git hook execution.
>
> ↳ Git hooks run in a minimal shell environment and do not automatically resolve project-local package binaries. If users install the hook from a repo using a local dependency (for example via npm/pnpm/yarn), `prsense` may not be found when `git push` runs, causing every push to fail.
>
> 💡 Write the shim to invoke the current executable path instead of the bare `prsense` command, or resolve and embed a stable launcher such as the package manager's local bin path.

### Diff context

The first version of the pre-push hook shim invoked the CLI by bare command name:

```sh
PRSENSE_NON_INTERACTIVE=1 prsense review . || exit $?
```

### Why this is non-trivial

Git hooks run with a stripped-down PATH — typically just `/usr/bin`, `/bin`, and sometimes `/usr/local/bin`. That means:

- `pnpm add @prsense/cli` (local install, binary in `node_modules/.bin`) → hook silently fails on every push.
- Volta/fnm/nvm-managed Node where shims live in version-manager-specific paths → may or may not work depending on the user's shell setup.
- macOS with Homebrew Node on Apple Silicon → `/opt/homebrew/bin` not always inherited into git's environment.

The fix was to resolve `process.execPath` (the running Node binary) and the CLI entry script at install time, embed both as absolute paths in the shim, and invoke `node /abs/path/to/cli.js` rather than `prsense`. As a bonus, this sidesteps Windows `.cmd` wrapper issues entirely.

### Would I have caught this myself?

No — I've bitten by hook PATH issues before in other projects. But probably not on the first pass, because the bare-command shim "looks right" if you're testing in a shell where `prsense` is already on PATH. The bug only manifests in the user environment you're not currently in. This is the textbook case where "external" review beats self-review.

---

## 2026-05 — Windows file:// URL handling

**File:** `apps/cli/src/commands/hook.ts`
**Commit:** `3647e47d5300c67a25e2c3e389b2f1586cd8f690`

### Signal

> [HIGH] `resolveLauncher` derives the current module directory from `import.meta.url` via `URL.pathname`, which breaks on Windows file URLs and can produce invalid paths like `/C:/...`.
>
> ↳ For `file://` URLs on Windows, `pathname` is not a valid filesystem path and remains percent-encoded. This makes the package.json walk fail or resolve the wrong location, so `prsense hook install` cannot install hooks on Windows.
>
> 💡 Use `fileURLToPath(import.meta.url)` from `node:url` and then `path.dirname(...)` to obtain a correct filesystem path across platforms.

### Diff context

```ts
const here = path.dirname(new URL(import.meta.url).pathname);
```

### Why this is non-trivial

`new URL("file:///C:/Users/foo/cli.js").pathname` returns `/C:/Users/foo/cli.js` on every platform — leading slash, drive letter encoded as a path segment. `path.dirname` doesn't repair this. Worse, percent-encoded characters (spaces, unicode) stay percent-encoded. The path _exists_ as a string but doesn't resolve as a filesystem entity.

`fileURLToPath` handles all four cases correctly: leading slash, drive letters, UNC paths, and percent-decoding. The fix is one import and one function call.

### Would I have caught this myself?

No. I haven't shipped a CLI that needed to install hooks on Windows before, and `import.meta.url` "works" on the platforms(unix like) I test on. This is the clearest case in the log of a signal catching something I personally would have missed.

---

## 2026-05 — Cross-file import claim (false positive, instructive)

**File:** `apps/cli/src/program.ts`

### Signal

> [HIGH] The new hook command is imported and registered, but there is no evidence in this change that `apps/cli/src/commands/hook.js` exists or exports `hookCommand`, which will cause the CLI entrypoint to fail at startup if the module is missing or mis-exported.

### Disposition

False positive. `hook.ts` existed; the import resolved correctly.

### Why it's still in this log

Two reasons:

**The reasoning was sound given the evidence.** The reviewer had access to the diff being pushed, which added an import to `program.ts` but didn't include the target module in the same change set. Concluding "I can't verify this import" is honest and correct _for what the reviewer could see_. The same signal pattern would have caught a genuinely forgotten file. Suppressing this signal type would weaken the tool against real bugs of the same shape.

**The severity was over-called.** `HIGH` is wrong for "I can't verify this from the diff alone." A future calibration pass should distinguish "I see a definite bug" from "I see a claim I can't ground." The latter is `MEDIUM` at most, often `INFO`.

**It points at a real product gap.** A grounded reviewer should be able to verify cross-file claims when the referenced file exists in the repository, even when it's not in the diff. The current context-builder doesn't fetch unreferenced files. The right enhancement: when the diff imports a symbol from a path, fetch that file's export list (not its full contents) and verify the symbol exists. This is a concrete backlog item the false positive surfaced.

### Would I have caught this myself?

Not applicable — there was nothing to catch. The value of this entry is in what it says about reviewer calibration, not about a missed bug.

---

## 2026-05 — Hooks directory resolution (partial truth, surfaced a real worktree edge case)

**File:** `apps/cli/src/commands/hook.ts`
**Commit:** `875c4fd33757edc3b71cb28dc3426cf16c063a1b`

### Signal

> [HIGH] The hooks directory is resolved relative to `process.cwd()`, which breaks when `prsense hook install` is run from a subdirectory of the repository.
>
> ↳ `git rev-parse --git-path hooks` returns a path relative to the repository's `.git` directory/worktree, not relative to the current working directory. Resolving that output against `process.cwd()` will produce an incorrect path like `<subdir>/.git/hooks` when invoked outside the repo root, causing the hook to be written to the wrong location or fail.
>
> 💡 Resolve the path against the repository top-level or use an absolute git path, e.g. obtain `git rev-parse --show-toplevel` and join from there, or use a git command/output that returns an absolute hooks path.

### Disposition

Partial truth. The bug claim was wrong (the code was correct), but the underlying instinct ("this is non-obviously correct and brittle") was right, and acting on the signal surfaced an unrelated real bug.

### What investigation revealed

`git rev-parse --git-path hooks` returns paths relative to `cwd`, not relative to the git directory as the signal claimed. From a subdirectory it returns `../../.git/hooks`, and `path.resolve(cwd, …)` normalizes the `..`s back to the correct absolute path. The original code worked correctly across plain repos, subdirectories, worktrees, submodules, and `core.hooksPath` overrides — verified by direct testing.

But the signal correctly smelled something off. Code that's correct _by accident_ — by relying on undocumented compatible behavior between two tools — invites regression. Any future reader (including future me) reads this as a bug and is tempted to "fix" it.

### What the fix actually did

Switched from `git rev-parse --git-path hooks` (correct but non-obvious) to `git rev-parse --git-common-dir` + explicit `path.join(commonDir, "hooks")`. Two consequences:

1. **The code is now self-evidently correct.** The next reader doesn't have to derive a proof.
2. **It uncovered a worktree edge case.** A naive first attempt used `--absolute-git-dir`, which returns the per-worktree `.git/worktrees/<name>/` directory — git does _not_ execute hooks from there. The correct invariant is `--git-common-dir`, which returns the shared `.git` directory across worktrees. The original `--git-path hooks` was masking this distinction by doing the right thing for worktrees automatically.

Also added handling for `core.hooksPath`: detected, honored, and surfaced as a warning since users with Husky or lefthook installed almost certainly don't want PRSense writing into their managed hooks directory.

### Would I have caught this myself?

The original "bug" — no, because there was no bug.

The deeper issue the investigation surfaced (worktree hooks directory semantics) — almost certainly not. I haven't worked extensively with git worktrees, and a quick test on a plain repo would have shown the code working perfectly. This is the kind of edge case that bites users in production six months after release, when someone reports "PRSense doesn't work in my worktree setup" and you'd have to reconstruct the git plumbing from scratch.

### Calibration note

The reviewer was wrong on the mechanism, right on the smell. That's a different failure mode than the previous false positive (which was "I can't verify cross-file claims from a diff alone"). Two distinct kinds of imperfection worth tracking separately:

- **Evidence-limited signals** (cycle 3): correct reasoning, incomplete evidence. Fix: better context-building.
- **Smell-driven signals** (this one): correct intuition, incorrect mechanism. Fix: harder to address structurally — possibly improvable with better prompt engineering around "explain the mechanism step by step before concluding."

Both belong in the log because both are honest about how a grounded reviewer actually performs in practice.

---

## 2026-05 — Relative `core.hooksPath` cwd-sensitivity (clean catch)

**File:** `apps/cli/src/commands/hook.ts`
**Commit:** `fb47a3c4ceecdedb8e86a40fd10a946c8899b565`

### Signal

> [MEDIUM] A relative `core.hooksPath` is resolved against the current working directory instead of the repository root, which installs or inspects the hook in the wrong location when the command is run outside the repo root.
>
> ↳ Git interprets a relative `core.hooksPath` relative to the directory where the config file lives (typically the repository root for local config), not the caller's current directory. Using `path.resolve(process.cwd(), hooksPath)` miscomputes the hooks directory from subdirectories.
>
> 💡 Resolve relative `core.hooksPath` against the repository root or the directory containing the config file, not `process.cwd()`.

### Disposition

Clean catch. Genuine bug, exactly as described.

### What investigation revealed

`git config --get core.hooksPath` returns the literal value stored in config — e.g. `.hooks` — regardless of the cwd it's invoked from. Git itself resolves that relative value against the working tree root (per `githooks(5)`), not the caller's cwd. The previous fix had added `path.resolve(process.cwd(), hooksPath)` for relative values, which produces `<subdir>/.hooks` instead of `<worktree-root>/.hooks` when invoked from a subdirectory.

This was a regression introduced in the _same pass_ that fixed the previous reviewer's concerns about hooks directory resolution. Adding handling for one configuration mode (`core.hooksPath`) without verifying how git itself interprets that mode is exactly the kind of casual extension that introduces this class of bug.

### The fix

Use `git rev-parse --path-format=absolute --show-toplevel` to obtain the worktree root, then `path.resolve(topLevel, hooksPath)` to anchor relative `core.hooksPath` values correctly. Verified across nine combinations: plain repo / repo subdir / worktree root / worktree subdir / submodule × `core.hooksPath` unset / absolute / relative.

### Would I have caught this myself?

No. The original implementation tested `core.hooksPath` only against absolute values during development. Relative values from a subdirectory is exactly the kind of multi-axis edge case that doesn't get exercised unless someone deliberately constructs the test, and the symptom — hook silently written to the wrong place — wouldn't surface until a user reported "I installed the hook but `git push` doesn't seem to invoke it" two months later.

---

## 2026-05 — `--git-common-dir` cwd-sensitivity (partial truth, motivated a cleaner form)

**File:** `apps/cli/src/commands/hook.ts`
**Branch / commit:** `feat/pre-push-hook` / `<commit>`

### Signal

> [HIGH] Git commands used to resolve the hooks directory run in the current working directory instead of the repository root, so `prsense hook install/status/uninstall` fails when invoked from a subdirectory of a repository or from a worktree subpath.
>
> ↳ `git rev-parse --git-common-dir` can return a relative path such as `.git`, but the code resolves it against `process.cwd()`. When the command is run below the repo root, this produces `<subdir>/.git` instead of the actual git dir, causing the hook path to be computed incorrectly.
>
> 💡 Resolve the repository root first (for example with `git rev-parse --show-toplevel`) and run the git commands with `cwd` set to that root, or resolve `--git-common-dir` relative to the actual git dir/repo root rather than `process.cwd()`.

### Disposition

Partial truth — same shape as the previous "smell-driven" entry. The bug claim was wrong; the underlying instinct was right; acting on the signal led to a cleaner implementation.

### What investigation revealed

From a subdir, `git rev-parse --git-common-dir` returns `../../.git`, not `.git`. The previous code used `path.resolve(process.cwd(), commonDir)` which correctly normalizes the `..`s back to the absolute git directory. The signal's claim that this produces `<subdir>/.git` is wrong.

But — for the second iteration running — the reviewer's smell was right. Relying on the interaction between git's cwd-relative output convention and node's `path.resolve` normalization is correct-by-accident. The next reader sees `path.resolve(process.cwd(), gitOutput)` and reasonably wonders whether it could produce the wrong path.

### The fix

Switch to `git rev-parse --path-format=absolute --git-common-dir`. This flag (git 2.31+, March 2021) forces absolute path output, removing the cwd-sensitivity question entirely. The code becomes unambiguously correct: git emits an absolute path, `path.join` produces an absolute path, no `path.resolve` dance is needed.

### Would I have caught this myself?

The original code was correct, so there was no bug to catch. The deeper question is: would I have written `--path-format=absolute` originally if I'd been thinking carefully about readability? Probably not — I didn't know the flag existed until this investigation. So the signal taught me a thing about git that I'll carry forward, which is a different kind of value than catching bugs.

---

## 2026-05 — Missing test coverage for path resolution (defensible defer)

**File:** `apps/cli/src/commands/hook.ts`

### Signal

> [MEDIUM] Missing test coverage for installing/status/uninstalling the hook when invoked from a repository subdirectory and when `core.hooksPath` is set to a relative path.
>
> ↳ The path resolution logic is sensitive to the caller's working directory and relative git paths; without these cases, the current regression is easy to miss.
>
> 💡 Add integration tests that run the hook commands from a nested repo directory and with a relative `core.hooksPath`, asserting the hook is written/read from the actual hooks directory.

### Disposition

Correct catch, deferred. Logged here as evidence that PRSense flagged a real coverage gap; not acted on in this pass. Currently thinking of making a flag to considering missing test coverage as an issue and ensuing nuances.

### Why deferred

The project's `README.md` lists `automated tests` as an outstanding TODO item. There is no integration test infrastructure for any CLI command yet — not `review`, not `index`, not `setup`, not `doctor`. Building out a test harness specifically for the hook command, ahead of one for the core review pipeline, is the wrong sequencing.

When integration test infrastructure does get built, this signal becomes the specification for what the hook command's tests must cover: subdir invocation, relative `core.hooksPath`, worktree subpaths, submodule paths, `core.hooksPath` unset, `core.hooksPath` absolute. The manual verification done across two iterations of fixes is the seed corpus; turning it into automated tests is mechanical work.

### Would I have caught this myself?

I would have logged "add tests eventually" as a vague TODO. I would not have specified the dimensions the tests need to cover. The signal turns vague intent into actionable spec, which is the more useful artifact.

### A note on signal-acting discipline

A reviewer is useful when its signals can be acted on, ignored, or deferred _based on judgment_, not based on reflex. This entry exists to make that judgment legible: the signal is correct, the action is wrong for this stage, the deferral is documented, and the path forward (write tests when the harness exists, using this signal as the spec) is clear. Logging deferrals is part of operating a reviewer well.

---

## 2026-05 — Unchecked git version requirement (clean catch on a documentation-only fix)

**File:** `apps/cli/src/commands/hook.ts`
**Commit:** `dcf51200cd5560ae3458af1a4635f99515c4aca0`

### Signal

> [HIGH] Hook installation/status/uninstall will fail on Git versions older than 2.31 because `git rev-parse --path-format=absolute` is unconditionally used.
>
> ↳ The command relies on `--path-format=absolute`, which is only available in newer Git releases. On older but still common installations, `git rev-parse` exits non-zero and the catch block misreports this as 'Not inside a git repository', making the feature unusable.
>
> 💡 Avoid requiring `--path-format=absolute`; either fall back to plain `git rev-parse --git-common-dir`/`--show-toplevel` and resolve relative paths in Node, or detect support for `--path-format` before using it.

### Disposition

Clean catch. The bug claim is correct: on git < 2.31, the user gets "Not inside a git repository" _while standing inside their git repository_. That's a misleading error, which is worse than a missing feature because it sends the user down the wrong debugging path.

### The first instinct that wasn't quite right

The immediate response was to update the README's requirements section to specify git ≥ 2.31 and consider the signal closed. That's a common engineering reflex — "I documented the requirement, therefore the requirement is satisfied" — and it doesn't actually fix the user-facing problem.

The README is a contract claim: _"if you meet these requirements, this works."_ The runtime check is a failure-mode guarantee: _"if you don't, you get a clear error."_ They're independent. A documented requirement without a runtime check still produces misleading errors for users who didn't read the docs (which is most users, most of the time).

This is the kind of distinction that's easy to miss when iterating quickly. The signal is technically about a missing version check, but the deeper lesson is about _what fixing a signal actually means_: the user-facing failure mode has to change, not just the project's documented stance toward it.

### The fix

Added an explicit `assertGitVersion()` check that runs before any other git operation. Parses `git --version` (handling Apple Git, Git for Windows, msysgit, and degenerate inputs), compares against the documented minimum, and throws a precise error if too old. Also added a dedicated `git rev-parse --is-inside-work-tree` check so the "not a git repo" path is distinct from "git is too old" and "something else broke" — three failure modes, three distinct messages.

The fix is roughly 30 lines and worth every one of them: each line removes a category of confusing user experience.

### What was deliberately not done

Option B — conditionally use `--path-format=absolute` if supported, fall back to manual cwd-relative resolution otherwise — was considered and rejected. Reasons:

1. The README already documents the minimum, and the runtime check now enforces it.
2. Supporting git < 2.31 means maintaining two code paths for path resolution, doubling the test surface for a feature that's already had three iterations of path-related signals.
3. The target audience (LLM-assisted local development on modern machines) effectively all has git ≥ 2.31. The audience that would benefit from Option B (very conservative enterprise Linux distros, hand-curated CI images) is not currently a priority.

If a user with an older git ever files an issue, the runtime check tells them exactly what's wrong, and the cost of revisiting then is small.

### Would I have caught this myself?

Not until a user reported it, at which point I'd have spent an hour debugging "PRSense thinks I'm not in a git repo when I clearly am" before tracing it back to git version. The signal compressed that hour into about 10 minutes — find the flag's introduction date, decide on Option A vs B, write the version check.

### A meta-observation

This is the fourth iteration on this single file. Each round has gotten smaller and more specific:

1. **Round 1** (PATH resolution): broad, architectural.
2. **Round 2** (Windows file URLs): specific, platform-specific.
3. **Round 3** (hooks directory resolution): smell-driven, surfaced a worktree edge case.
4. **Round 4** (relative `core.hooksPath`, `--git-common-dir` smell, missing tests): mix of clean catch, smell-driven, and deferred coverage.
5. **Round 5** (this one — git version): catches a real failure mode the developer tried to close with documentation alone.

The pattern is exactly what you'd want from a competent reviewer collaborating on a feature: each round finds the next layer of issue once the previous ones are resolved. The diminishing returns are real but informative — they tell you when the feature is ready to merge.

If a sixth round produces only LOW signals or comes back clean, that's the convergence point.

---

## 2026-05 — `core.hooksPath` resolution: delegate to git (partial truth on mechanism, real win on simplification)

**File:** `apps/cli/src/commands/hook.ts`
**Commit**: `0e047c5241e9dfec978fe30b0c7a2370708b0a80`

### Signal

> [HIGH] Relative `core.hooksPath` is resolved against the worktree root, but Git resolves it relative to the directory where the config value is defined.
>
> ↳ When `core.hooksPath` is set in a repo-local config, a relative value is interpreted by Git relative to the repository's `.git` directory, not the working tree root. This implementation installs the hook into a different directory for common setups like `git config core.hooksPath .githooks`, so the hook will appear installed but Git will never execute it.
>
> 💡 Determine where `core.hooksPath` is defined (for example via `git config --show-origin --get core.hooksPath`) and resolve relative paths against that config file's directory, or delegate path resolution to Git instead of resolving it manually.

### Disposition

Mechanism: wrong. Direction: completely right.

### What investigation revealed

Direct experimental verification: set `core.hooksPath = .githooks` in repo-local config, place identical hook scripts in both `worktree-root/.githooks/` and `.git/.githooks/`, and observe which git runs. The answer is the worktree root, both from the repo root and from deep subdirectories. Same result for `core.hooksPath` in global gitconfig — git resolves against the _current repo's_ worktree root, not the home directory.

So the signal's claim — that git resolves relative `core.hooksPath` against the config file's directory — is incorrect. The previous code was matching git's actual behavior.

### But the suggested fix is the right fix anyway

The signal's secondary suggestion — "delegate path resolution to Git instead of resolving it manually" — turned out to be the _correct_ move, for reasons unrelated to the mechanism claim:

`git rev-parse --path-format=absolute --git-path hooks` already does _all_ the resolution work: honors `core.hooksPath`, resolves relative values correctly, handles worktrees (uses the shared common dir), and emits absolute paths regardless of cwd. The previous implementation was a 30-line block of `path.resolve` / `path.isAbsolute` / `path.join` gymnastics replicating what git already exposes through a single command.

The fix collapses that block to one `execSync` call.

### Why this is the most valuable signal in the log so far

The previous code worked correctly across every scenario I tested across four prior iterations. It was right. But it was right _the hard way_: by re-implementing logic that git already implements, taking on maintenance responsibility for edge cases that git's maintainers already handle. The signal pushed the implementation from "correct by careful effort" to "correct by leverage."

This is a different kind of value than catching bugs. It's catching _misplaced effort_ — work that didn't need to be done at all, that introduced ongoing maintenance burden, and that was statistically going to produce a future bug. The previous iteration's actual bug (relative `core.hooksPath` resolved against `cwd` instead of worktree root) was exactly that statistical bug-in-waiting, manifested.

### Would I have caught this myself?

Almost certainly not. I would have continued patching the manual path-resolution code, each patch fixing one edge case and silently introducing one more. The pattern of "30 lines of careful code where one execSync would do" is hard to see from the inside; you have to step back and ask "why am I doing this at all?", and you only do that when prompted.

---

## 2026-05 — Monorepo package.json walk (smell-driven, real improvement)

**File:** `apps/cli/src/commands/hook.ts`
**Branch / commit:** `feat/pre-push-hook` / `<commit>`

### Signal

> [MEDIUM] `resolveLauncher` can stop at the workspace root `package.json` and embed the wrong entrypoint when the CLI package is inside a monorepo.
>
> ↳ The search accepts the first `package.json` found while walking upward, but in a monorepo the nearest `package.json` may be the repository root rather than the CLI package. If that `package.json` has a `bin` or `main` field, the generated hook will point at the wrong script and fail at push time.
>
> 💡 Continue walking until you find the `package.json` for the prsense CLI package specifically, or derive the entrypoint from a known path relative to this module instead of the first `package.json` encountered.

### Disposition

Partial truth — same shape as several previous smell-driven signals. The bug doesn't manifest in the current install layouts I tested, but the code is brittle in exactly the way described, and the fix is cheap and strictly better.

### What investigation revealed

In every realistic install topology — npm global, pnpm symlinked, development checkout, dist-from-source — the CLI module's own `package.json` is the first one encountered during the upward walk. The bug as literally described doesn't fire.

But construct any layout where the module's directory tree doesn't contain its own `package.json` until many levels up (e.g. an unusual packaging artifact, a custom build script that relocates the compiled output, a future refactor that moves `apps/cli/src/commands/` somewhere else) — and the walk silently picks up the workspace root's `package.json`, which in this project has `"main": "index.js"`. The hook shim then points at a nonexistent file, and `git push` starts failing with "CLI not found at /path/to/monorepo/index.js."

### The fix

Match by `name === "@prsense/cli"` instead of taking the first `package.json` found. Walk further (10 levels instead of 6) to accommodate weirder layouts. Throw a diagnostic error if no matching package.json is found, rather than silently embedding the wrong one.

The "throw if not found" piece is the most important change: the previous code's failure mode was "embed wrong path silently, fail at push time." The new failure mode is "fail at install time with a clear error." Always prefer the failure that happens nearer to the cause.

### Would I have caught this myself?

No. The original code worked in every layout I tested, and "match by name" wouldn't have occurred to me as an improvement until someone pointed out the failure mode. This is the textbook smell-driven catch: the code is locally correct but globally fragile, and the fragility is invisible from the inside.

---

## The smell-driven pattern: a characterization

Across iterations 3, 4, 6, and 7, PRSense produced four signals with the same shape:

1. The signal claims a specific bug.
2. The bug claim is incorrect — the code, on direct experimental verification, does what it should.
3. But the code is brittle, non-obvious, or reinventing functionality available elsewhere.
4. The fix suggested by the signal (or a close variant) makes the code measurably better — shorter, more delegating, less likely to break under future modification.

This is no longer an anomaly. It's a consistent behavior worth naming explicitly because it changes how the signals should be consumed.

### Two kinds of catches, two consumption patterns

**Specific-bug catches** are valuable per instance. Each prevents a concrete failure. Mechanism claim and fix direction both correct. (Examples in this log: PATH resolution, Windows file URLs, git version check, relative `core.hooksPath` cwd resolution, concurrency input validation.)

**Smell-driven signals** are valuable per pattern. They push code toward shapes that are durably correct rather than locally correct. Mechanism claim often wrong; fix direction often right. (Examples in this log: `--git-path hooks` instead of cwd-relative resolution, `--git-common-dir` instead of `--absolute-git-dir`, delegate to git instead of re-implementing path resolution, match-by-name package walk.)

Both are useful. They require different consumption discipline:

- A user who treats every smell-driven signal as a clean catch will over-engineer.
- A user who treats them as false positives will miss the real benefit — code that's durably correct rather than accidentally correct.
- The right discipline: investigate the mechanism, and even if it's wrong, ask "is the underlying smell pointing at something I can fix cheaply?" Usually the answer is yes.

## 2026-06-23 — Synthesized baseline false positive

**Context:** Deleted `retrieveContext` (pre-v0.14 leftover, zero prod callers)
and rewrote `contextExclusion.test.ts` against `RagContextProvider`
directly — the production path post-v0.14's per-file architecture.

**Signal (HIGH, dismissed):**

> The new test now depends on a real embedding client and external
> credentials, turning a previously isolated unit/integration test into
> one that will fail in normal test environments without OpenAI/Ollama
> configured. The removed test path used the local repository directly
> and did not require network services or API keys.

**Why it's wrong:** The old test called
`retrieveContext({ config: testConfig(), ... })`, which constructs an
ollama/openai embedder from the same config and calls `.embed()` on it.
The runtime dependency is identical — same provider, same model, same
network call. PRSense fabricated a "previously isolated" baseline that
never existed.

**Mechanism:** The diff showed the _removal_ of `retrieveContext`'s call
site but not the body of `retrieveContext` itself (defined in a separate
file, fully deleted, no longer in the post-state). With no visibility
into what the removed function actually did, the model had to invent a
baseline to reason about "what changed" — and invented a cleaner one
than reality.

**Tag:** `synthesized-baseline` — model confabulates the pre-change state
of a symbol whose definition is outside the diff in order to frame a
removal as a regression.

**Not a prompt problem.** The prompt already constrains against this
("Only report concrete problems introduced by this change"). The model
violated it because it lacked the information to ground the claim. No
prompt rule fully fixes a missing-information failure.

**Architectural lever (deferred):** When a diff removes a symbol whose
definition lives elsewhere in the pre-change tree, optionally pull that
definition into the per-file context. The model would then have the
actual baseline to compare against. Symbol-graph work in progress
(`SymbolGraphContextProvider`) is adjacent but solves the cross-file
call-site problem, not this one. Worth a follow-up issue.

**Action:** Dismissed signal. Added a comment to the test explaining the
intentional integration shape. Watching for recurrence before tuning the
prompt.
