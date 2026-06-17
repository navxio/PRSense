<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/prsense-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/prsense-logo-light.svg">
    <img src="assets/prsense-logo-light.svg" width="80" alt="PRSense">
  </picture>
</p>
<h1 align="center">PRSense</h1>
<p align="center">
  <sub>High-confidence signals for pull request review</sub>
</p>

**PRSense is an open-source, self-hosted, LLM-powered code review CLI that surfaces high-confidence review signals from pull request changes.**

<p align="center">
  <img src="https://img.shields.io/github/license/navxio/prsense" />
  <img src="https://img.shields.io/npm/dw/%40prsense%2Fcli" />
  <img src="https://img.shields.io/npm/v/@prsense/cli" />
</p>

> PRSense is experimental software, expect bugs.

## Example Review

Review of a real-world pull request:

✔ Signals reference actual changed files
✔ No hallucinated files or symbols
✔ 0 hallucinated signals (validated against diff)
✔ Signals are derived directly from pull request diff

**Excerpt from CLI output**

![Example PRSense output](docs/example.png)

PRSense does not rewrite your code or flood your PR with generic comments.

It surfaces what matters:

- What changed
- Where risk exists
- Why attention is warranted

It is built for engineers who want review assistance that is:

- Intentional
- Inspectable
- Deterministic
- Local-first

## Table of Contents

- [Philosophy](#philosophy)
- [Features](#features)
- [What PRSense Does Not Do](#what-prsense-does-not-do)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Design](#design)
- [Architecture](#architecture)
- [Command Reference](#command-reference)
- [Benchmarks](#benchmarks)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [License](#license)

## Philosophy

PRSense is built around a few core principles:

- human-in-the-loop decision making
- high signal, low noise
- local-first and self-hosted operation
- transparency over automation
- inspectable reasoning
- composability over monoliths

## Features

- **Fast, local-first CLI** for reviewing and analyzing code changes
- **Self-hosted by default** — runs entirely on your own machine, no external services required
- **Zero-infrastructure** — bundled SQLite + sqlite-vec, no database to provision
- **Diff-first intelligence**, understanding:
  - local changes
  - pull request diffs from GitHub, GitLab, and Codeberg / Forgejo
- **Pluggable LLM backends** — Ollama, Anthropic, Google, OpenAI
- **Pre-push git hook** — gate pushes on review outcome (`prsense hook install`)
- Tested with real-world C, C++, Rust, Go, TypeScript, Python, and Java repositories (see [Benchmarks](#benchmarks) and [Example Signals](docs/raw_signals.md))

## Requirements

- Node.js >= 22 <25
- git >= 2.31
- (optional) Ollama for local inference

## Installation

```bash
npm i -g @prsense/cli
```

First run will walk you through provider setup:

```bash
prsense init
```

## What PRSense Does Not Do

PRSense intentionally avoids actions that reduce developer agency:

- It does not write or modify code
- It does not open or merge pull requests
- It does not enforce opinions or style choices
- It does not act autonomously

## Usage

### Review a local repository

```bash
prsense review .
```

Compares your current branch against the configured base branch and prints review signals to stdout.

### Review a GitHub Pull Request

```bash
prsense review https://github.com/owner/repo/pull/123
```

### Review a GitLab Merge Request

```bash
prsense review https://gitlab.com/group/project/-/merge_requests/42
```

### Review a Codeberg / Forgejo Pull Request

```bash
prsense review https://codeberg.org/owner/repo/pulls/7
```

### Index a repository (enable contextual review)

```bash
prsense index .
```

Builds a semantic index of the repository to enable contextual (RAG-enhanced) reviews.

Optional flags:

```bash
prsense index . --force
prsense index . --dry-run
prsense index . --stats
```

### Install the pre-push hook

```bash
prsense hook install
```

Runs PRSense against each pushed ref before the push completes. Bypass with `git push --no-verify`. See `prsense hook --help` for details.

### Diagnose your setup

```bash
prsense doctor
```

## Configuration

```
defaults
   ↓
global config
   ↓
repo config
   ↓
CLI flags
   ↓
Resolved Configuration
```

PRSense separates **review behavior** from **runtime credentials**.

### Configuration Layers (Lowest → Highest Priority)

1. Built-in defaults
2. Global config (`~/.config/prsense/config.yml`)
3. Repository config (`prsense.yml`)
4. CLI flags

Environment variables are used exclusively for **credentials**, never review behavior.

This ensures:

- Reproducible reviews
- No secrets in source control
- Deterministic layering
- Clear separation of domain vs runtime concerns

### Global Configuration (Optional)

Location:

```
$XDG_CONFIG_HOME/prsense/config.yml
```

or

```
~/.config/prsense/config.yml
```

Global config defines personal defaults applied to all repositories.

```yaml
llm:
  provider: ollama
  model: qwen2.5-coder
  temperature: 0.1

embeddings:
  provider: ollama
  model: nomic-embed-text
```

Repository config overrides global config.

### Repository Configuration (`prsense.yml`)

Placed at the root of your repository. Defines review behavior:

```yaml
llm:
  provider: ollama # ollama | openai | google | anthropic
  model: deepseek-coder-v2
  temperature: 0.1

embeddings:
  provider: ollama # ollama | openai | google
  model: nomic-embed-text

index:
  chunkSizeChars: 1000
  chunkOverlapChars: 200

review:
  confidenceThreshold: 0.8
  topSignals: 3

context:
  maxChunks: 5

git:
  baseBranch: main
```

### Configuration Sections

#### `llm`

Controls the review generation model. `temperature` controls randomness; lower values produce more deterministic output.

#### `embeddings`

Controls vector embeddings used for indexing and retrieval. If changed, re-indexing is required.

#### `index`

Controls repository chunking.

- `chunkSizeChars` — characters per chunk
- `chunkOverlapChars` — overlap between chunks

#### `review`

Controls signal filtering.

- `confidenceThreshold` — minimum confidence
- `topSignals` — number of highest-priority signals emitted

#### `context`

Controls retrieval (RAG).

- `maxChunks` — number of chunks retrieved **per changed file**

### Environment Variables

Credentials only. Never store in `prsense.yml`.

#### LLM credentials

| Provider | Variable                         |
| -------- | -------------------------------- |
| OpenAI   | `PRSENSE_OPENAI_API_KEY`         |
| Gemini   | `PRSENSE_GOOGLE_API_KEY`         |
| Claude   | `PRSENSE_ANTHROPIC_API_KEY`      |
| Ollama   | `PRSENSE_OLLAMA_HOST` (optional) |

#### VCS read tokens (for remote PR/MR review)

| Platform           | Variable                 |
| ------------------ | ------------------------ |
| GitHub             | `PRSENSE_GITHUB_TOKEN`   |
| GitLab             | `PRSENSE_GITLAB_TOKEN`   |
| Codeberg / Forgejo | `PRSENSE_CODEBERG_TOKEN` |

#### Storage

Bundled SQLite + sqlite-vec. Stored under the PRSense state directory (`~/.local/state/prsense/`). No setup required.

#### Logging

```
PRSENSE_LOG_LEVEL=debug | info | warn | error
```

### Inspecting Effective Configuration

```bash
prsense config inspect
```

Shows the layered merge with provenance per field, plus credential availability per provider (never the secrets themselves).

### Defaults

If no configuration is provided:

- `ollama` is used as the default LLM provider
- `nomic-embed-text` is used for embeddings
- Safe chunking defaults applied

### Security Notes

- Never commit API keys or tokens.
- Global config should not contain secrets.

### Configuration Summary

| Type              | Location                       | Purpose              |
| ----------------- | ------------------------------ | -------------------- |
| Global defaults   | `~/.config/prsense/config.yml` | Personal defaults    |
| Repository config | `prsense.yml`                  | Review behavior      |
| Credentials       | Environment variables          | Secrets / API access |

## Design

PRSense is built using a hexagonal (ports-and-adapters) architecture.

This design separates core review logic from external concerns such as Git, filesystems, databases, LLM providers, and user interfaces. The goal is to keep the system easy to reason about, test, and extend.

### Core (Domain + Engine)

At the center of PRSense is a small, declarative core:

- domain types such as ReviewSignal and ReviewContext
- pure review logic and orchestration
- no direct IO
- no network access
- no filesystem assumptions

The core does not know where data comes from or where results go. It only operates on well-defined inputs and produces structured outputs.

This makes the core:

- deterministic
- testable
- portable
- resistant to integration churn

### Ports

Ports are the abstract boundaries through which the core interacts with the outside world.

In PRSense, ports take the form of TypeScript interfaces and function contracts, for example:

- context retrievers
- LLM providers
- embedding generators
- vector stores
- reporters

Ports describe _what_ the core needs, not _how_ it is implemented.

### Adapters

Adapters live at the edges of the system and implement ports.

Examples include:

- filesystem-based context retrieval
- git diff ingestion
- Ollama or OpenAI LLM providers
- CLI reporters

Adapters are inherently imperative and may fail. Those failures are handled at the boundary, not inside the core.

### Imperative Shell

The outermost layer consists of applications that parse user input, load configuration, wire adapters together, call the core, and present results.

The shell is free to be messy. The core is not.

### Why This Matters

This architecture allows PRSense to:

- swap LLM providers without touching review logic
- add new retrieval strategies without rewriting the engine
- support new VCS platforms with a small adapter
- remain understandable as complexity grows

Most importantly, it allows PRSense to treat LLMs as interchangeable tools rather than structural dependencies.

The result is a system that is flexible without being fragile.

## Architecture

          ┌─────────────┐
          │   Git / PR  │
          └──────┬──────┘
                 │
            [ Diff Input ]
                 │
        ┌────────▼────────┐
        │ Ingestion       │
        │ (diff + meta)   │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Context Builder │◄──── Repository, files, history
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Review Engine   │
        │ (LLM + Context) │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Signal Compiler │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ Reporters       │
        │ (CLI, others)   │
        └─────────────────┘

PRSense follows a hexagonal architecture:

- a declarative domain core
- a functional review engine
- imperative adapters for IO, git, LLMs, and storage

```

CLI
─────────────── execution environment
Workflows
─────────────── orchestration
Engine / Context / Adapters / LLM
─────────────── capabilities
Domain
─────────────── pure types

```

### Monorepo Layout

```
apps/
  cli/         # CLI entrypoint

packages/
  core/        # core domain types and engine
  context/     # diff parsing and contextual retrieval
  llm/         # LLM provider abstractions
  config/      # prsense.yml and env validation
  reporters/   # CLI and other output formats
  workflows/   # review and indexing workflows
  preflight/   # executable infrastructure checks
  logging/     # structured logging
  bench/       # benchmarking primitives
```

## Command Reference

A complete command reference is available in:

[docs/man/prsense.1](docs/man/prsense.1)

## Benchmarks

Benchmarks track per-review latency, token usage, and grounding metrics for flagship and local (Ollama) models.

See [benchmarks.json](packages/bench/bench-results/2026-03-19T14-32-19.234Z.json).

### Running benchmarks

Clone the repo, install with `pnpm i` from the root, then:

1. Create a GitHub token and set `PRSENSE_GITHUB_BENCH_TOKEN`
2. `pnpm bench`

Ensure cloud provider credentials are set, and Ollama is running with the models under test available.

## Project Status

PRSense is under active development. Interfaces and core concepts are stabilizing; integrations and signal-quality work continue.

### Roadmap

- [x] incremental indexing
- [x] AST-based chunking (TypeScript)
- [x] Codeberg / Forgejo support
- [ ] AST-based chunking (Python, Go, Rust, C++)
- [ ] hybrid retrieval strategy
- [ ] symbol-graph context provider
- [ ] machine-readable output mode (`--json` / NDJSON)
- [ ] optional multi-pass review

## Contributing

PRs welcome.

## License

PRSense is licensed under the Apache 2.0 License.
