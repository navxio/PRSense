# Changelog

All notable changes to PRSense are documented here.
This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] — 2026-05-29

### Breaking

- **Removed Postgres backend.** PRSense now uses bundled SQLite
  (better-sqlite3 + sqlite-vec) and no longer requires Docker or a
  Postgres container. The `database` block in `.prsense.config.*` is
  ignored and can be removed.

### Migration

On first run after upgrading, PRSense will detect the old configuration
and print migration instructions. To upgrade:

1. Update PRSense: `npm i -g @prsense/cli@0.7`
2. Re-run `prsense index` on each repository — your previous index will
   be regenerated locally.
3. (Optional) Reclaim space from the old Postgres container:
   `docker rm prsense_postgres`
   `docker volume rm postgres_data`

## v0.6.1

### Changed

- default model `deepseek-coder-v2`
- default `confidenceThreshold` = 0.8

## v0.6.0

### Added

- Automatic incremental indexing before every review (skip with `--no-auto-index`)
- Add `auto` option to index config

## v0.5.1

### Changed

- `maxSignals` in config defaults to 3
- Retrieved context ignores files already in the diff

## v0.5.0

### Changed

- CLI is now bundled with tsup for faster cold start and smaller install
- [If daemon bundled] Daemon is now bundled with tsup
- Internal workspace packages [are now private | remain published for daemon's dependency tree]

### Migration

- No user-visible changes
- Same commands, same flags, same outputs

## v0.4.0

### Breaking changes

- Removed the `daemon` subcommand from the CLI. The daemon is now
  distributed as a separate package, `@prsense/daemon`, with its own
  binary `prsense-daemon`. If you were using `prsense daemon start`,
  install the daemon directly:

      npm i -g @prsense/daemon
      prsense-daemon

## v0.3.1 — Pre-push review hook

### Added

- `prsense hook install/uninstall/status` for managing a pre-push git hook
  that runs PRSense against each pushed ref before the push completes
- `--base-ref <sha>` flag on `prsense review` for reviewing against an
  explicit base commit (used internally by the hook; also useful for ad-hoc
  diff scoping)
- `PRSENSE_NON_INTERACTIVE` environment variable to suppress first-run setup
  prompts in non-interactive contexts such as git hooks

### Changed

- Hook commands resolve git paths through `git rev-parse --path-format=absolute`
  and `--git-path hooks`, delegating path resolution (including `core.hooksPath`,
  worktrees, and submodules) to git rather than reimplementing it
- Hook shim embeds absolute paths to Node and the CLI entry at install time,
  avoiding PATH-dependence in git's reduced hook environment

### Fixed

- Cross-platform module path resolution uses `fileURLToPath` rather than
  `URL.pathname`, fixing CLI initialization on Windows
- Hook installation detects existing non-PRSense hooks and refuses to
  overwrite them without `--force`
- Hook installation warns when `core.hooksPath` is set (e.g. Husky, lefthook)
  so users aren't surprised by hooks landing in a managed directory

### Requirements

- Git 2.31 or newer is now required (checked at runtime with a clear error
  if older)

### Notes

- The hook is opt-in. Run `prsense hook install` from a repo root to enable;
  bypass any individual push with `git push --no-verify`
- This release was dogfooded end-to-end: PRSense reviewed the branch that
  implements the hook across six iterations. See `docs/in-the-wild.md` for
  the review log.

## v0.3.0

### Added

- Concurrent file reviews for significantly faster review execution on multi-file diffs
- Bounded concurrency orchestration with isolated per-file failure handling
- New review workflow concurrency events for improved observability

### Improved

- Reduced end-to-end review latency for large pull requests
- Improved review workflow resilience and aggregation behavior
- Refactored review execution pipeline for reusable orchestration primitives

## v0.2.1 — First-time setup and validation

### Added

- Interactive first-time setup triggered automatically when no config is found
- LLM provider selection (Ollama, OpenAI, Anthropic, Google)
- Default model assignment per provider
- API key validation before completing setup
- Graceful cancellation handling during setup

### Changed

- Setup now validates API keys before writing config
- Configuration is generated with required `llm.model` for all providers
- Improved onboarding flow: setup → validation → ready to run
- Environment variable is set in-process after validation for immediate use

### Fixed

- Invalid API keys no longer pass silently during first run
- Prevented broken configs being written when validation fails
- Fixed TypeScript issues around provider/model typing and API error parsing
- Ensured consistent provider handling across setup and runtime

## v0.2.0

Incremental Indexing

### Features

• Added incremental indexing based on Git changes (modified, added, deleted, renamed files)
• Introduced plan-based indexing (full, incremental, noop)
• Implemented intelligent planning via planIndex (commit diff, embedding config, chunking version)
• Added noop execution path for no-change scenarios

Indexing Behavior
• Incremental deletion of stale chunks for deleted/renamed files
• Prevented duplication of unchanged chunks
• Improved handling of dirty working trees
• Added safeguards for revision mismatch

Architecture
• Refactored indexWorkflow into modular stages (planning, diffing, chunking, embedding, persistence)
• Extracted reusable utilities into util.ts
• Introduced getLocalPath() for repository access
• Standardized all repository sources to operate on local Git clones

Diff System
• Added computeDiff for file-level change detection
• Improved Git diff handling (rename/copy support, malformed output handling)
• Hardened against command injection and edge cases

Testing
• Added comprehensive incremental indexing test suite
• Covered updates, deletions, renames, multi-commit diffs, noop scenarios, large files
• Introduced PostgreSQL-backed test setup and helpers
• Fixed Jest + TypeScript integration

Bug Fixes
• Fixed stale chunk data after re-indexing
• Fixed path traversal and path normalization issues
• Fixed rename/delete edge cases
• Fixed diff parsing inconsistencies
• Fixed incorrect rebuild triggers and workflow edge cases

CLI / Behavior Changes
• Added explicit rebuild requirement flow for incompatible index state
• Updated event naming and handling (WorkflowIndexRebuildRequired)
• Improved prompt accuracy and reduced noisy logs

Breaking Changes
• RepositorySource renamed to GitBackedRepositorySource
• New required method: getLocalPath()
• Removed or relocated context-related types from @prsense/core
• Changes to public exports in @prsense/core and @prsense/context

Notes
• System now assumes repositories are Git-backed and locally accessible
• Incremental indexing is the default when applicable
• Foundation laid for future blob-based diffing
