<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/prsense-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/prsense-logo-light.svg">
    <img src="assets/prsense-logo-light.svg" width="80" alt="PRSense">
  </picture>
</p>
<h1 align="center">PRSense</h1>
<p align="center">
  <sub>High-confidence signals grounded in diff</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@prsense/cli"><img src="https://img.shields.io/npm/v/@prsense/cli?color=cb3837&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@prsense/cli"><img src="https://img.shields.io/npm/dw/%40prsense%2Fcli?color=cb3837" alt="npm downloads"></a>
  <a href="https://github.com/navxio/prsense/blob/main/LICENSE"><img src="https://img.shields.io/github/license/navxio/prsense?color=blue" alt="License"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@prsense/cli?color=339933" alt="Node version"></a>
  <a href="https://discord.gg/sX3WBw8Zr"><img src="https://img.shields.io/badge/chat-discord-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
</p>

**PRSense (Patch-Review Sense) is an open-source, LLM-powered code review engine that surfaces high-confidence review signals from diff.**

> PRSense is experimental software, expect bugs.

---

<p align="center">
  <img src="assets/demo.gif" alt="PRSense in action" width="900">
</p>

---

## Table of Contents

- [Philosophy](#philosophy)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Design](#design)
- [Architecture](#architecture)
- [Command Reference](#command-reference)
- [Benchmarks](#benchmarks)
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
- extensibility via hexagonal architecture — make it your own

## Features

- **Fast, local-first CLI** for reviewing and analyzing code changes
- **Self-hosted by default** — run entirely on your own machine, no external services required
- **Zero-infrastructure** — bundled SQLite + sqlite-vec, no database to provision
- One-command setup
- Automatically reads your intent from branch name locally or PR description
- Pluggable models, or run everything locally via Ollama
- Auto-indexing by default for context-enriched review
- Human-in-the-loop decision making
- **Diff-first intelligence**, understanding:
  - local changes
  - pull request diffs from GitHub, GitLab, and Codeberg / Forgejo
- **Pluggable LLM backends** — Ollama, Anthropic, Google, OpenAI
- Built-in profiling
- Automatically reads from and writes to local `.env`
- AST-based chunking for TypeScript (more languages on the roadmap)
- Deterministic pipeline for identifying cross-file issues
- Bundled `pre-push` git hook
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

### Typical Workflow

1. `prsense index .`
2. `prsense review .`

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

PRSense separates **review behavior** from **runtime credentials**. Configuration is layered and deterministic.

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

- LLM provider and model
- Embedding model
- Chunking strategy
- Review thresholds
- Retrieval limits

### Example

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

Controls the review generation model. Supported providers: `ollama`, `openai`, `google`, `anthropic`. `temperature` controls randomness; lower values produce more deterministic output.

#### `embeddings`

Controls vector embeddings used for indexing and retrieval. If changed, re-indexing is required and embedding dimensions must match the database schema.

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

## Command Reference

A complete command reference is available in:

[docs/man/prsense.1](docs/man/prsense.1)

or just run `man prsense`

## Benchmarks

Benchmarks track per-review latency, token usage, and grounding metrics for flagship and local (Ollama) models.

See [benchmarks.json](packages/bench/bench-results/2026-03-19T14-32-19.234Z.json).

### Running benchmarks

Clone the repo, install with `pnpm i` from the root, then:

1. Create a GitHub token and set `PRSENSE_GITHUB_BENCH_TOKEN`
2. `pnpm bench`

Ensure cloud provider credentials are set, and Ollama is running with the models under test available.

## Contributing

PRs welcome.

## License

PRSense is licensed under the Apache 2.0 License.
