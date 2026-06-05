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

**PRSense is an open-source, LLM-powered code review engine that surfaces high-confidence review signals from pull request changes.**

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
- Self-hosted

PRSense separates review logic from delivery. The same core engine can run:

- Locally via CLI
- As a long-lived daemon
- Behind webhooks

This keeps the review system transparent and infrastructure-friendly while remaining flexible in how it is deployed.

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
- **Self-hosted by default** — run entirely on your own machine or infrastructure
- **Persistent background daemon**
  - Idempotent job creation
- **Diff-first intelligence**, understanding:
  - local changes
  - pull request diffs from GitHub, GitLab
- **Pluggable LLM backends** - Ollama, Anthropic, Google, OpenAI
- **Flexible outputs** for humans and machines:
  - terminal summaries
  - GitHub/GitLab pull request comments
- Tested with real world C, C++, Rust, Go, TypeScript, Python, Java repositories (See [Benchmarks](#benchmarks) and [Example Signals](docs/raw_signals.md))

## Requirements

- Node.Js >= 22 <25
- git >=2.31
- (optional)Ollama

## Installation

`npm i -g @prsense/cli`

## What PRSense Does Not Do

PRSense intentionally avoids actions that reduce developer agency:

- It does not write or modify code
- It does not open or merge pull requests
- It does not enforce opinions or style choices
- It does not act autonomously

## Usage

PRSense is an AI-powered code review engine that can run in two modes:

- **CLI mode** — local, interactive usage (this package, `@prsense/cli`)
- **Daemon mode** — long-lived HTTP service for automation and webhooks (separate package, `@prsense/daemon`)

Both modes use the same core review engine and configuration model.

### CLI Mode

The CLI is ideal for local development and experimentation.

#### Review a local repository

```bash
prsense review .
```

Compares your current branch against the configured base branch and prints review signals to stdout.

#### Review a GitHub Pull Request

```bash
prsense review https://github.com/owner/repo/pull/123
```

#### Review a GitLab Merge Request

```bash
prsense review https://gitlab.com/group/project/-/merge_requests/42
```

#### Index a repository (enable contextual review)

```bash
prsense index .
```

This builds a semantic index of the repository to enable contextual (RAG-enhanced) reviews.

Optional flags:

```bash
prsense index . --force
prsense index . --dry-run
prsense index . --stats
```

### Daemon Mode

The daemon runs PRSense as a long-lived HTTP service, intended for automation and webhook-based review. It is distributed as a separate package.

#### Install and start the daemon

```bash
npm i -g @prsense/daemon
prsense-daemon
```

By default, it listens on:

```
http://localhost:11000
```

#### Health & Readiness

```
GET /health
GET /ready
```

Example:

```bash
curl http://localhost:11000/health
```

#### Trigger Review via API

```
POST /jobs/review
```

Example:

```bash
curl -X POST http://localhost:11000/jobs/review \
  -H "Content-Type: application/json" \
  -d '{"target":"https://github.com/owner/repo/pull/123"}'
```

Response:

```json
{
  "jobId": "..."
}
```

#### Trigger Indexing via API

```
POST /jobs/index
```

Example:

```bash
curl -X POST http://localhost:11000/jobs/index \
  -H "Content-Type: application/json" \
  -d '{"target":"https://github.com/owner/repo"}'
```

### Webhook Endpoints

The daemon supports webhook-triggered reviews.

#### GitHub

```
POST /webhooks/github
```

Requires: `PRSENSE_GITHUB_WEBHOOK_SECRET`

Supports `pull_request` events: `opened`, `synchronize`.

#### GitLab

```
POST /webhooks/gitlab
```

Requires: `PRSENSE_GITLAB_WEBHOOK_SECRET`

Supports `merge_request` events.

### How It All Fits Together

- **CLI mode** is interactive and developer-focused.
- **Daemon mode** is automation-focused.
- Both share the same configuration, indexing system, review workflow, and validation pipeline.

PRSense is delivery-agnostic — the core engine remains the same.

### Typical Workflows

#### Local Development

1. `prsense index .`
2. `prsense review .`

#### Team Automation

1. Install and run the daemon: `npm i -g @prsense/daemon && prsense-daemon`
2. Configure GitHub/GitLab webhook
3. Reviews trigger automatically on PR/MR updates

## Configuration

This is the configuration structure

```
defaults
   ↓
global config
   ↓
repo config
   ↓
environment variables
   ↓
derive runtime fields
   ↓
validate
   ↓
Resolved Environment
```

PRSense separates **review behavior** from **runtime infrastructure configuration**.

Configuration is layered and deterministic.

### Configuration Layers (Lowest → Highest Priority)

1. Built-in defaults
2. Global config (`~/.config/prsense/config.yml`)
3. Repository config (`prsense.yml`)
4. CLI flags (when applicable)

Environment variables are used exclusively for **credentials and infrastructure**, never review behavior.

This ensures:

- Reproducible reviews
- No secrets in source control
- Deterministic layering
- Clear separation of domain vs runtime concerns

## Global Configuration (Optional)

Location:

```
$XDG_CONFIG_HOME/prsense/config.yml
```

or

```
~/.config/prsense/config.yml
```

Global config defines personal defaults applied to all repositories.

Example:

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

## Repository Configuration (`prsense.yml`)

Placed at the root of your repository.

This file defines review behavior:

- LLM provider and model
- Embedding model
- Chunking strategy
- Review thresholds
- Retrieval limits
- Delivery channels (daemon mode)

## Example

```yaml
llm:
  provider: ollama # ollama | openai | google | anthropic
  model: deepseek-coder-v2
  temperature: 0.1

embeddings:
  provider: ollama # ollama | openai
  model: nomic-embed-text

index:
  chunkSizeChars: 1000
  chunkOverlapChars: 200

review:
  confidenceThreshold: 0.8
  maxSignals: 3

context:
  maxChunks: 5

git:
  baseBranch: main

# Daemon mode only
delivery:
  platform: github # github | gitlab
```

## Configuration Sections Explained

## `llm`

Controls review generation model.

Supported providers:

- `ollama`
- `openai`
- `google`
- `anthropic`

`temperature` controls randomness.

Lower values produce more deterministic output.

## `embeddings`

Controls vector embeddings used for indexing and retrieval.

If changed:

- Re-indexing is required.
- Embedding dimensions must match the database schema.

## `index`

Controls repository chunking.

- `chunkSizeChars` — characters per chunk.
- `chunkOverlapChars` — overlap between chunks.

## `review`

Controls signal filtering.

- `confidenceThreshold` — minimum confidence.
- `maxSignals` — maximum number of emitted signals.

## `context`

Controls retrieval (RAG).

- `maxChunks` — number of chunks retrieved per review.

## `delivery` (Daemon Mode Only)

Defines where review results are posted.

Example:

```yaml
delivery:
  - github
  - slack
```

Rules:

- Only one VCS channel allowed (`github` or `gitlab`)
- Additional channels optional (`slack`, `jira`)

Ignored in CLI mode.

## Environment Variables

Environment variables configure runtime infrastructure and credentials.

They are never stored in `prsense.yml`.

## LLM Credentials

| Provider | Variable                         |
| -------- | -------------------------------- |
| OpenAI   | `PRSENSE_OPENAI_API_KEY`         |
| Gemini   | `PRSENSE_GOOGLE_API_KEY`         |
| Claude   | `PRSENSE_ANTHROPIC_API_KEY`      |
| Ollama   | `PRSENSE_OLLAMA_HOST` (optional) |

## Embeddings (OpenAI)

```
PRSENSE_OPENAI_API_KEY
```

## Database

Bundled sqlite with sqlite-vec. Used for indexing.

```

## GitHub Delivery

### Personal Access Token

```

PRSENSE_GITHUB_TOKEN
PRSENSE_GITHUB_WEBHOOK_SECRET

```

### GitHub App (Recommended)

```

PRSENSE_GITHUB_APP_ID
PRSENSE_GITHUB_APP_PRIVATE_KEY
PRSENSE_GITHUB_INSTALLATION_ID
PRSENSE_GITHUB_WEBHOOK_SECRET

```

## GitLab Delivery

```

PRSENSE_GITLAB_TOKEN
PRSENSE_GITLAB_WEBHOOK_SECRET

```

## Slack Delivery

```

PRSENSE_SLACK_BOT_TOKEN

```

## Logging

```

PRSENSE_LOG_LEVEL=debug | info | warn | error

````

## CLI Mode vs Daemon Mode

### CLI Mode

- Loads global + repo config
- Ignores `delivery`
- No webhook secrets required
- Can run fully local

Example:

```sh
prsense review .
````

### Daemon Mode

- Loads global config at startup
- Validates credentials at boot
- Requires delivery configuration
- Requires webhook secrets
- Loads repo config dynamically per review job

Start daemon:

```sh
prsense-daemon
```

Daemon refuses to start if:

- Delivery enabled but credentials missing
- Webhook secret missing
- Required LLM credentials missing

### Inspecting Effective Configuration

You can inspect merged configuration:

```sh
prsense config inspect
```

This shows:

- Global config
- Repository config
- Effective merged config
- Runtime resolved config
- Credential availability

### Defaults

If no configuration is provided:

- `ollama` is used as default LLM
- `nomic-embed-text` used for embeddings
- Safe chunking defaults applied
- No delivery enabled

### Security Notes

- Never commit API keys.
- Never commit webhook secrets.
- Prefer GitHub App over PAT in production.
- Use separate credentials for staging/production.
- Global config should not contain secrets.

### Configuration Summary

| Type              | Location                              | Purpose                |
| ----------------- | ------------------------------------- | ---------------------- |
| Global defaults   | `~/.config/prsense/config.yml`        | Personal defaults      |
| Repository config | `prsense.yml`                         | Review behavior        |
| Credentials       | Environment variables                 | Secrets / API access   |
| Database          | Environment variables                 | Index storage          |
| Delivery channels | `prsense.yml` + environment variables | Posting review results |

PRSense enforces strict separation between domain behavior and runtime credentials to ensure reproducibility, determinism, and security.

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

The outermost layer consists of applications:

- the CLI
- background workers
- future GitHub integrations

These applications:

- parse user input
- load configuration
- wire adapters together
- call the core
- present results

The shell is free to be messy. The core is not.

### Why This Matters

This architecture allows PRSense to:

- run locally, or as a service
- swap LLM providers without touching review logic
- add new retrieval strategies without rewriting the engine
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


CLI / Daemon / GitHub App
─────────────── execution environments
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
  cli/ # CLI entrypoint
  daemon/ # http + scheduler

packages/
  core/ # core domain types and engine
  context/ # diff parsing and contextual retrieval
  llm/ # LLM provider abstractions
  config/ # prsense.yml and env validation
  reporters/ # CLI and other output formats
  workflows/ # all workflows (cli+daemon)
  preflight/ #executable infa truths and enforcement
  logging/ # structured logging
  bench/ # benchmarking primitives
```

## Command Reference

A complete command reference is available in:

[docs/man/prsense.1](docs/man/prsense.1)

## Benchmarks

Currently benchmarks track the time for each review, token usage, grounding etc for flagship
models and local models via ollama

See [benchmarks.json](packages/bench/bench-results/2026-03-19T14-32-19.234Z.json)

#### Running benchmarking

You can run the benchmarks on your own machine by cloning the repository, installing the packages with `pnpm i` from the root

1. Create a github token and set it up `PRSENSE_GITHUB_BENCH_TOKEN`
2. `pnpm bench`

Make sure all the environment variables related to cloud providers have been set up and ollama is running with the models being tested available

## Project Status

PRSense is under active development.

Interfaces and core concepts are stabilizing, while integrations and performance improvements continue.

## ToDo

- [x] incremental indexing
- [ ] hybrid retrieval strategy
- [ ] ast based chunking
- [ ] codeberg support
- [ ] multiple embedding dimensions
- [ ] automated tests
- [ ] optional multi pass review
- [ ] gh action

## Contributing

PRs are welcome

## Similar Projects

- [pr-agent](https://github.com/<>/<>)

## License

PRSense is licensed under the Apache 2.0 License.
