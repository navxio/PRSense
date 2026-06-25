# Changelog

All notable changes to PRSense are documented here.
This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.18.1] — 2026-06-25

### Fixed

- `LocalGitDiffProvider` no longer throws on the clean-tree path when
  `git merge-base` fails (unborn HEAD, no common ancestor). Falls back
  to the resolved base branch so diff generation can proceed;
  symbol-graph degrades cleanly when the fallback is a bare ref rather
  than a SHA.

- `findExportedDeclarations` now surfaces anonymous `export default
function () {}` and `export default class {}` declarations under the
  synthetic name `"default"`. Symbol lookup already used
  `getDefaultExportSymbol()` for default-kind candidates, so reference
  queries flow through without further changes.

- `gitObjectReader.listTree` and HEAD enumeration in `loadProjects`
  invoke git with `-c core.quotepath=false`. Filenames containing
  non-ASCII bytes now resolve correctly rather than C-quoted, matching
  existing conventions elsewhere in the codebase.

## [0.18.0] — 2026-06-25

### Added

- **Symbol-graph context provider.** Reviews now surface direct callers
  of exported declarations whose signatures changed at the type level.
  Complements RAG: RAG covers semantic relatedness, symbol-graph covers
  structural dependency. Built on `ts-morph`; two `Project`s are loaded
  per job (HEAD from the working tree, base from the diff target via
  `git cat-file --batch` into an in-memory FS) and compared via
  resolved-type signature strings. Direct callers from the HEAD `Project`
  are ranked (same-PR > same-package > workspace), capped at 5 per
  symbol, and rendered as the enclosing statement at each call site.
  TypeScript only in v1.

- **Sectioned per-file context.** `formatContextForFile` now groups
  retrieved chunks by provider into `### Direct callers of changed
symbols` (references) and `### Similar code` (RAG). Sub-grouped by
  symbol under references; per-symbol truncation marker rendered when
  the cap fires.

- **Diff-provider `baseRevision`.** All `DiffProvider` implementations
  (`LocalGit`, `GitHubPr`, `GitLabMr`, `CodebergPr`) now resolve and
  expose the base SHA alongside `revision`. Required by symbol-graph;
  available to future providers and reporters.

- **Symbol-graph telemetry events.**
  - `workflow.review.symbol_graph.projects.loaded` —
    `{ headFiles, baseFiles, durationMs }`, emitted once per job.
  - `workflow.review.symbol_graph.references.retrieved` —
    `{ symbol, file, totalRefs, shownRefs }`, emitted per triggered
    symbol. `totalRefs > shownRefs` indicates the per-symbol cap fired.
  - `workflow.review.context.retrieved` now also emitted by the
    symbol-graph provider, mirroring the RAG contract.

### Changed

- `ContextAvailabilityInput` now carries `diff`. Required by
  symbol-graph's candidate gate; existing `RagContextProvider` ignores
  it. Test mocks implementing `ContextProvider.isAvailable` need to
  accept the new field.

- `DiffProvider.load()` return type extends with required
  `baseRevision: string`. Where the underlying source cannot resolve a
  base (e.g. an unborn HEAD on `LocalGitDiffProvider`), the provider
  emits a `"unknown"` sentinel; `SymbolGraphContextProvider` treats it
  as unavailable.

- CLI bundle excludes `typescript` and `ts-morph`. Required for ESM
  bundling correctness; install footprint grows by ~60 MB.

### Fixed

- `findExportedDeclarations` now surfaces anonymous `export default
function` and `export default class` declarations under the synthetic
  name `"default"`.

- `gitObjectReader.listTree` and HEAD enumeration in `loadProjects`
  invoke git with `-c core.quotepath=false`. Filenames containing
  non-ASCII bytes are now read correctly rather than C-quoted.

- Reference detection in symbol-graph recognises method and namespaced
  calls (`obj.foo()`, `ns.foo()`). Previously only direct calls and
  property-access LHS references were treated as call sites.

- `SymbolGraphContextProvider` keys candidate state by revision.
  Previously, repeated `isAvailable` invocations within one provider
  instance would clobber state — latent in current usage, broken under
  any future per-file availability pattern.

- Reference chunks derive `language` metadata from the file path
  instead of hard-coding `"typescript"`.

### Notes

- Dogfooded on this PR. Symbol-graph closed one bug class cleanly
  (signature-change-breaks-caller) and surfaced a second related class
  (interface-change-breaks-implementer) that v1's call-site-only
  reference filter does not cover. Tracked for v1.1; see
  `docs/in-the-wild.md`.

- No `prsense.yml` changes. The per-symbol reference cap (5) is fixed
  in this release; tunability deferred pending dogfooding data.

## [0.17.1] — 2026-06-23

### Fixed

- Review prompt formatting: removed stacked blank lines from
  conditional metadata sections and stopped wrapping branch names
  in literal quotes (`JSON.stringify` artifact). No semantic change
  to the prompt; cleaner input to the LLM.

### Notes

- LLM outputs with `"type": "style"` will now be dropped by the
  normalizer. In practice this should be rare since the prompt has
  never instructed the LLM to emit "style".
- `validateReviewOutput` still only shape-checks the `signals` array.
  Per-signal schema validation (confidence range, required fields)
  is a follow-up.

### Fixed

- Review prompt formatting: removed stacked blank lines from
  conditional metadata sections and stopped wrapping branch names
  in literal quotes (`JSON.stringify` artifact). No semantic change
  to the prompt; cleaner input to the LLM.

## [0.17.0] — 2026-06-23

### Breaking

- **`retrieveContext` removed from `@prsense/workflows`.** This was a
  pre-v0.14 leftover from before the `ContextProvider` port landed and
  had no production callers — only a single test referenced it
  directly. Downstream consumers who imported it should migrate to
  `RagContextProvider` from `@prsense/context`, which is the actual
  production retrieval path.

### Fixed

- `resolveContext` now reads the OpenAI API key from
  `PRSENSE_OPENAI_API_KEY`, matching the rest of the codebase. It
  previously read `OPENAI_API_KEY`, which silently fell through to
  `undefined` for users following the documented setup and caused
  OpenAI-embedding-backed reviews to fail at the embedding client.

### Notes

- The `contextExclusion` test has been rewritten against
  `RagContextProvider` and now exercises the same retrieval path
  production code runs through.

## [0.16.2] — 2026-06-22

### Fixed

- **Indexing failed when embedding dimension changed.** Switching
  embedding providers with `--force` (e.g. ollama → openai) detected
  the incompatibility but then crashed on insert because the
  `vec_rag_chunks` virtual table retained its original dimension.
  `ensureVecTable` now drops and recreates the vec table when the
  requested dimension differs from the existing one, and clears
  `rag_chunks` to keep rowids consistent.

- **LLM provider errors were opaque.** All three providers wrapped
  SDK failures in a generic `"<provider> request failed"` string,
  discarding status codes, error types, and messages. Errors now
  surface the underlying detail:
  - OpenAI: status, error type, code, and message via
    `OpenAI.APIError`.
  - Anthropic: status and nested `error.error.{type,message}` via
    `Anthropic.APIError`.
  - Google: status, code, and reason read defensively from the
    SDK's error shape.

- **Empty LLM responses gave no diagnostic.** Gemini and Claude can
  return empty text for reasons that were silently dropped (safety
  blocks, max-token finish, recitation filters, stop reasons).
  Empty-response errors now include `finishReason` /
  `blockReason` (Gemini) and `stopReason` (Claude).

### Internal

- `runIndexWorkflow` accepts an optional `injectedEmbeddingClient`
  parameter. When provided, the provider/credentials branch is
  skipped. Enables dimension-change regression coverage without
  network calls; matches the existing injection pattern for
  `chunkRepository` and `metadataRepository`.

### Tests

- Added regression test in `incremental.test.ts` covering
  force-rebuild across an embedding dimension change (768 → 1536).

### Known follow-ups

- OpenAI's gpt-5 family rejects non-default `temperature` on some
  models. Tracked separately; the improved error surfacing now
  makes this immediately diagnosable from logs.

## [0.16.1] - 2026-06-22

### Fixed

- `ReviewSignal` type consistently defined as 'bug' | 'risk' | 'test'

## [0.16.0] — 2026-06-19

### Added

- **Codeberg indexing.** `prsense index https://codeberg.org/<owner>/<repo>`
  now clones and indexes Codeberg repositories. Closes the parity gap
  with `prsense review` against Codeberg PRs introduced in 0.15.0.

### Fixed

- **Private-repo indexing for GitHub and GitLab.** `resolveRepositorySource`
  was constructing `GitHubRepositorySource` and `GitLabRepositorySource`
  without passing the configured token, so indexing a private repo by
  URL failed at clone time despite `PRSENSE_GITHUB_TOKEN` or
  `PRSENSE_GITLAB_TOKEN` being set. Tokens now thread from
  `CredentialContext` through to each clone-based source.
- Codeberg private-repo indexing benefits from the same fix at
  introduction.

### Internal

- `resolveRepositorySource` now takes `CredentialContext` as a required
  parameter. Internal API; no impact outside the workflows package.

### Notes

- Self-hosted Forgejo hosts are not yet routed to `CodebergRepositorySource`
  — `classifyTarget` only matches `codeberg.org`. A `host` parameter or
  CLI flag is a follow-up.
- The three clone-based sources duplicate the same shell-out pattern.
  Collapsing into a single `HttpsCloneRepositorySource` is tracked
  separately; the existing `execSync` call sites should migrate to
  `execFileSync` as part of that work.

## [0.15.4] — 2026-06-19

### Fixed

- **Repo root resolution from subdirectories.** Every CLI command
  (`review`, `index`, `config inspect`, `doctor`) was deriving the
  repository root from `process.cwd()` rather than the actual git root.
  Running from any subdirectory silently fell back to default
  configuration (`baseBranch: main`), bypassing `prsense.yml` and
  triggering `git rev-parse` / `git diff` failures against the
  configured base branch. Root is now resolved via
  `git rev-parse --show-toplevel`.

### Changed

- **Target classification centralized.** Each command previously
  duplicated its own URL regex set and path resolution, with subtle
  drift (e.g. `index` had no Codeberg support; `review` did). All
  commands now route through a single `classifyTarget` helper that
  returns a discriminated `ClassifiedTarget` union covering GitHub,
  GitLab, Codeberg (PR/MR and bare-repo URL forms), and filesystem.
- `runIndexWorkflow` and `resolveRepositorySource` now consume
  `ClassifiedTarget` rather than re-parsing a raw target string.
  URL parsing happens exactly once, at the CLI edge.
- Review now surfaces a clear error when given a non-PR URL (e.g.
  `github.com/org/repo` without `/pull/N`), instead of misclassifying
  it as a local path.

### Internal

- `ClassifiedTarget` lives in `@prsense/core` as a pure domain type;
  `classifyTarget` (the function, which shells out for repo-root
  discovery) stays at the CLI edge.

### Notes

- Codeberg indexing dispatch is stubbed pending a follow-up PR; review
  against Codeberg PRs is unchanged.

## [0.15.3] — 2026-06-19

### Fixed

- `prsense review` from a subdirectory now resolves `prsense.yml` and
  runs git subprocesses against the repository root rather than the
  invoking cwd. Previously, running from any subdir silently fell back
  to defaults (`baseBranch: main`) and emitted `git rev-parse` /
  `git diff` failures against the configured branch.
  sending the full context.
- extract shared helper findRepoRoot
- reduce ollama embedder's maxInputChars to 3000
- `maxInputTokens` now mandatory on EmbeddingClient type

### Notes

- `config inspect` and `index` still resolve their root from cwd; fix
  lands in a follow-up that consolidates target classification into a
  single shared helper.

## [0.15.2] — 2026-06-18

### Changed

- `prsense init` now prompts for the default base branch (prefilled with
  `main`) and writes it to `git.baseBranch` in the generated config.

## [0.15.1] — 2026-06-17

### Fixed

- Manpage: remove stale Postgres/pgvector references, drop daemon-only
  env vars and config keys, align config example with current schema,
  add Codeberg as a review target.

## [0.15.0] — 2026-06-17

### Added

- **Codeberg support.** PRSense can now review pull requests hosted on
  Codeberg (and self-hosted Forgejo instances via host parameter).
  - `CodebergPrDiffProvider` — fetches PR metadata and unified diff via
    the Forgejo v1 API using native `fetch` (no SDK dependency).
  - `CodebergRepositorySource` — clones Codeberg repositories for
    contextual indexing.
  - `CodebergReporter` — upserts a single review comment per PR using
    the `<!-- PRSENSE:REVIEW -->` marker, with defensive pagination.
  - URL dispatch in `prsense review` recognizes
    `https://codeberg.org/<owner>/<repo>/pulls/<n>` targets.
  - Configurable host (default `codeberg.org`) on all three adapters
    for self-hosted Forgejo support.

### Changed

- **`RepositoryProvider` is now the single source of truth.** Replaced
  inline `"github" | "gitlab" | "filesystem"` unions across
  `@prsense/config` with imports from `@prsense/core`. Adding future
  providers is now a one-line change in `packages/core/src/repository/identity.ts`.
- Exposed `REPOSITORY_PROVIDERS` as a `const` tuple alongside the type,
  enabling iteration without pulling Zod into `@prsense/core`.

### Environment

- New environment variables:
  - `PRSENSE_CODEBERG_TOKEN` — Codeberg/Forgejo personal access token.
  - `PRSENSE_CODEBERG_WEBHOOK_SECRET` — webhook secret for future
    daemon-mode delivery.

### Tests

- Added `resolveCredentials` coverage for Codeberg token and webhook
  secret resolution.

### Notes

- Codeberg daemon-mode delivery (webhooks, `delivery.platform: codeberg`)
  is not yet wired. CLI review is the supported surface in this release.
- This release was dogfooded against its own implementation PR; one
  shell-injection signal was a true positive and is fixed above. See
  `docs/in-the-wild.md` for the full review log.

## [0.14.4] - 2026-06-16

### Fixed

- Wire totalBeforeCap into printSignals, align reviewWorkflow to the same, fix build

## [0.14.3] - 2026-06-16

### Fixed

- Report total number of signals whenever they differ from number of top signals

## [0.14.2] - 2026-06-16

### Changed

- Remove `logLevel` from runtimeShape

## [0.14.1] - 2026-06-15

### Fixed

- Tune OpenAI embedding provider parameters, reduced MAX_TOKENS_PER_REQUEST to 150_000
- Better estimate token generation from string(code+english text) to <string length> / 2
- Fix bench build errors by using ResolvedConfigSchema.parse({})
- Fix RagContextProvider, buildFileEmbeddingQuery module test type errors
- Fix `prsense init` bug with google as embeddings provider
- Migrate from deprecated google generative AI sdk to `@google/genai` v2.8.0

### Changed

- Remove unused `@changesets/cli` package

## [0.14.0] - 2026-06-15

### Changed

- **RAG context retrieval is now per-file.** Each changed file gets a
  targeted embedding query (path + hunks + PR title) and its own chunk
  budget, instead of a single PR-wide retrieval shared across all files.
  Reviews see more focused context per file.

- **`context.maxChunks` now applies per file.** With the default of 5
  and an N-file PR, total chunks retrieved is now ~5N rather than 5.
  Lower the value if cumulative prompt size becomes a concern.

### Internal

- Introduced `ContextProvider` port in `@prsense/core`. RAG retrieval
  is now an adapter (`RagContextProvider` in `@prsense/context`) behind
  it, setting the seam for future context sources.
- Unified `EmbeddingClient` interface in `@prsense/core`; `@prsense/llm`
  now depends on `@prsense/core`.

### Migration

No re-indexing required. If you've tuned `context.maxChunks` above the
default, consider lowering it — the value now applies per file rather
than per PR.

## [0.13.0] — 2026-06-12

### Changed

- Redesigned CLI signal output for higher signal-to-noise. Severity now
  renders as a colored badge, file paths are cyan, the claim is at full
  weight, evidence is dimmed under a `↳` leader, and suggestions appear
  in green under `💡`. Inline backticked code is highlighted within each
  block.
- CLI output now wraps at word boundaries instead of breaking mid-token.
  Width adapts to the terminal, capped at 100 columns for readability.
- Signal-printing logic moved from `apps/cli` into `@prsense/reporters`
  as `printSignals`, matching the existing `printStats` shape.

### Notes

- ANSI styling auto-disables when stdout is not a TTY (pipes, files, CI
  without color support), so existing scripts that grep plain CLI output
  are unaffected.
- The `2 of N signal(s) shown` footer is now `N signals` when no
  suppression occurred; the `M of N` form appears only when the
  `topSignals` cap actually trimmed results.

## [0.12.0] — 2026-06-12

### Breaking

- `chunkingVersion` bumped to 4. Existing indexes must be rebuilt with
  `prsense index . --force`.

### Changed

- Indexing now filters non-code files out of retrieval:
  - Tree-anywhere noise directories: `node_modules`, `dist`, `build`,
    `out`, `coverage`, `target`, `vendor`, `.github`, `.gitlab`,
    `.husky`, `.vscode`, `.idea`, `.next`, `.turbo`, `.cache`
  - Dotfiles at any depth (`.prettierrc`, `.editorconfig`,
    `.gitattributes`, `.nvmrc`, ...)
  - Tracked meta documents (`LICENSE*`, `CONTRIBUTING*`, `CHANGELOG*`,
    `CODE_OF_CONDUCT*`, `SECURITY*`, ...) when their extension is
    doc-ish (`.md`, `.rst`, `.txt`, `.adoc`, or none). Both hyphen and
    underscore separators recognized (`CHANGELOG-2024.md`,
    `CHANGELOG_2024.md`, `CODE_OF_CONDUCT.md`).
  - `README*` is intentionally retained — architectural intent lives there
- `git ls-files` no longer includes `--others`. Only tracked files are
  considered for indexing; anything uncommitted is treated as noise.

### Fixed

- Chunk version was hardcoded in five separate sites in `indexWorkflow`,
  with the planner's fingerprint and the metadata writer reading from
  different literals. Drift between them caused every post-`force` run
  to plan a full rebuild instead of incremental or noop. Unified behind
  a single `CHUNK_VERSION` constant.
- Removed a duplicate `incompatibilityReasons` push for the embedding
  provider/model check.

### Notes

- Deny-list filter is hardcoded; project-specific noise belongs in
  `.gitignore`.
- Under `context.maxChunks`, every chunk slot is contested. Meta files
  and tooling configs are tracked-on-purpose but contribute no semantic
  signal to code review and crowd out useful retrieval.

## [0.11.6] — 2026-06-11

### Fixed

- Wired in ollama service check

## [0.11.5] — 2026-06-11

### Changed

- Minor improvements to the init command

## [0.11.4] — 2026-06-11

### Added

- RunConfigDetermined event as core event for every workflow run

### Changed

- RunConfigDetermined is emitted on every index / review workflow run after
  finalising the config

## [0.11.3] — 2026-06-10

### Breaking

- review.maxSignals renamed to review.topSignals; CLI flag --max-signals → --top-signals

## [0.11.2] — 2026-06-09

### Changed

- Consolidated all structural config validation into the Zod schema.
  `validateResolvedConfig` and the workflow-scoped validators in
  `apps/cli/.../validation` are gone; the schema is now the single source
  of truth for shape, ranges, cross-field rules (e.g. `chunkOverlapChars
< chunkSizeChars`), and the daemon→delivery requirement.
- Defaults now live on the schema via `.prefault({})`. The standalone
  `defaults` export is removed; `RuntimeConfigSchema.parse({})` yields a
  fully-populated baseline. `prsense init` derives its boilerplate the
  same way.

### Fixed

- `resolveConfig` cache is now keyed by `(mode, repository.root)`. The
  previous module-level cache ignored its arguments and returned the
  first resolved config for every subsequent call.
- `resolveConfig` reads `prsense.yml` from the supplied repository root
  rather than `process.cwd()`, fixing wrong-config resolution when the
  CLI is invoked from a subdirectory.
- `buildResolvedConfig` no longer carries a stale Postgres connection
  string and no longer relies on a non-null assertion for `delivery`.
- `prsense config inspect` now actually prints the resolved configuration
  table. The previous output rendered the header and separator but
  dropped every row. The misleading "Sources" legend (left over from
  the removed provenance tracking) is gone.
- `prsense.yml` is now resolved from the repository root rather than the
  current working directory. Running CLI commands from subdirectories
  previously failed to pick up the repository's config.

### Internal

- Added a comprehensive Jest suite for `@prsense/config` covering
  schema refinements, layered merging, credential resolution, cache
  behavior, and the resolved-environment integration.

## 0.11.1

### Changed

Review output now lists displayed vs generated signal numbers

## [0.11.0] — 2026-06-06

### Changed

- **Review prompt recalibrated.** Reframed from "senior software
  engineer" to a precision-oriented review assistant whose value is
  measured by signal actionability, not signal count. Severity now
  carries an explicit triage rubric:
  - `high` — will fire on inputs the code actually produces today
  - `medium` — latent fragility a plausible near-term change could trip
  - `low` — theoretical concern requiring inputs the code path cannot produce

  Expect a noticeable shift in severity distribution on the same
  diffs: fewer `high` signals, more `medium`, fewer signals overall.
  This is intentional.

### Removed

- Source-of-truth disambiguation block from the review prompt. It
  compensated for a RAG staleness problem resolved architecturally in
  earlier releases and was priming the model to expect conflicts that
  no longer occur.

### Notes

- No config, flag, or schema changes. Existing `prsense.yml` files
  continue to work unchanged.
- If you've tuned thresholds or downstream automation around the
  previous severity distribution, re-check after upgrading.

## [0.10.0] — 2026-06-05

### Changed

- Embedding throughput improved on multi-file indexing runs.
  - Per-provider batch sizes (OpenAI 512, Google 100, Ollama 32).
  - Concurrent in-flight embedding requests for cloud providers
    (OpenAI 6, Google 4; Ollama remains serial).
  - Prepared statement reuse in the SQLite chunk repository.

No configuration changes required.

## 0.9.0 - 2026-06-05

### Changed

- `prsense init` now configures a single provider for both review and embeddings.
  Choices: Ollama, OpenAI, Google.
- API keys are now written to `.env` in the current directory instead of printed
  as shell `export` instructions.
- Updated default models to current recommendations:
  - OpenAI: `gpt-5.4-mini` (review), `text-embedding-3-small` (embeddings)
  - Google: `gemini-2.5-flash` (review), `gemini-embedding-001` (embeddings)
  - Ollama: unchanged

### Removed

- Anthropic dropped from `prsense init` choices. Anthropic has no embeddings API,
  so single-key setup isn't possible. Users who want Claude for review can still
  configure it manually in `prsense.yml` alongside a separate embeddings provider.

### Added

- Google embeddings provider (`gemini-embedding-001` via `@google/generative-ai`).

## 0.8.2

### Changed

- manpage is now automatically installed on `npm i -g @prsense/cli`

## 0.8.1

### Fixed

- Now `maxSignals` is respected and returned with decreasing priority of signals

## [0.8.0] — 2026-06-04

### Breaking

- **Removed Postgres backend.** PRSense now uses bundled SQLite
  (better-sqlite3 + sqlite-vec) and no longer requires Docker or a
  Postgres container. The `database` block in `.prsense.config.*` is
  ignored and can be removed.

### Migration

On first run after upgrading, PRSense will detect the old configuration
and print migration instructions. To upgrade:

1. Update PRSense: `npm i -g @prsense/cli@0.8`
2. Re-run `prsense index` on each repository — your previous index will
   be regenerated locally.

3. (Optional) Reclaim space from the old Postgres container:
   `docker rm prsense_postgres`
   `docker volume rm postgres_data`

## v0.7.0

### Breaking Changes

- Chunking format updated (version 3). Existing indexes are incompatible
  and must be rebuilt with `prsense index . --force`.

### Added

- TypeScript files (`.ts`, `.tsx`) are now chunked along semantic boundaries
  — functions, classes, interfaces, type aliases, top-level declarations —
  rather than fixed character windows. Improves retrieval relevance for
  symbol-level queries. Other file types continue to use character-based
  chunking.

### Fixed

- Chunker no longer drops top-level control-flow statements (`if`, `for`,
  `try`, etc.), preventing silent content loss in entry-point files.
- `export default function` and `export default class` declarations are
  now correctly indexed.
- Oversized declarations are split safely without exceeding configured
  character limits.

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
- Daemon is now bundled with tsup
- Internal workspace packages are now private / remain published for daemon's dependency tree

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
