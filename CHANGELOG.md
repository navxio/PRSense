# Changelog

## v0.3.0

Added

- Concurrent file reviews for significantly faster review execution on multi-file diffs
- Bounded concurrency orchestration with isolated per-file failure handling
- New review workflow concurrency events for improved observability

Improved

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
